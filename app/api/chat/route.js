import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import axios from "axios";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadFileToS3 = async (fileBuffer, fileName) => {
  const uploadParams = {
    Bucket: "uchith",
    Key: `documents/${Date.now()}-${fileName}`,
    Body: fileBuffer,
    ContentType: 'application/pdf',
    ACL: 'public-read',
  };

  await s3Client.send(new PutObjectCommand(uploadParams));
  return `https://${uploadParams.Bucket}.s3.amazonaws.com/${uploadParams.Key}`;
};

export async function POST(req) {
  try {
    const { action, documentBase64, documentName, question, extractedInfo } = await req.json();

    if (action === 'process-document') {
      const documentBuffer = Buffer.from(documentBase64, 'base64');
      const documentUrl = await uploadFileToS3(documentBuffer, documentName);
      
      const response = await axios.get(documentUrl, { responseType: "arraybuffer" });
      const tempFilePath = path.join("/tmp", path.basename(documentUrl));
      
      fs.writeFileSync(tempFilePath, Buffer.from(response.data));
      const uploadResponse = await fileManager.uploadFile(tempFilePath, {
        mimeType: "application/pdf",
        displayName: "Chat Document",
      });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: "application/pdf",
            fileUri: uploadResponse.file.uri,
          },
        },
        { text: "Extract and structure all information from this document. Each and every line and word is important. Make sure all data is extracted." }
      ]);

      fs.unlinkSync(tempFilePath);
      return NextResponse.json({ 
        extractedInfo: result.response.text(),
        documentUrl
      });

    } else if (action === 'ask-question') {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        { text: `Using this extracted information: ${extractedInfo}\n\nAnswer this question: ${question}` },
        { text: "If the answer isn't found, respond: 'This information is not available in the document.'" }
      ]);

      return NextResponse.json({ 
        response: result.response.text() 
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}