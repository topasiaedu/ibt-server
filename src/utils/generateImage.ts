import * as fabric from 'fabric'
import * as fs from 'fs/promises'
import * as path from 'path'
import { Contact } from '../db/contacts'

// const fontPath = path.join(__dirname, 'fonts', 'arial-unicode-ms.ttf');

// Assuming you have a font file named 'YourChineseFont.ttf' in the 'fonts' directory
// fabric.registerFont(fontPath, { family: 'Arial Unicode MS' });

// Function to check if a string contains Chinese characters
function containsChinese(text: string): boolean {
  return /[\u3400-\u9FBF]/.test(text)
}

// Function to generate an image from canvas state
export async function generateImage(
  canvasState: any,
  contact: Contact
): Promise<string> {
  if (!canvasState || !contact) {
    throw new Error('Canvas state or contact is missing')
  }

  const uniqueID = Math.random().toString(36).substr(2, 9)

  const width = canvasState.width || 500
  const height = canvasState.height || 500

  const canvas = new fabric.StaticCanvas(undefined, {
    width,
    height,
    backgroundColor: 'white',
  })


  canvasState.objects = canvasState.objects.map((object: any) => {
    try {
      if (object.type === "textbox") {
        // Replace object.text with name if %name% is found
        const text = object.text.replace(/%name%/g, contact.name);
        return { ...object, text }; // return a new object with the updated text
      }
      return object;
    } catch (err) {
      throw new Error(`Error updating text: ${(err as unknown as any).message}`);
    }
  });


  canvasState.objects.forEach((obj: any) => {
    if (obj.type === 'textbox' && containsChinese(obj.text)) {
      obj.fontFamily = 'Arial Unicode MS'
    }
  })

  return new Promise((resolve, reject) => {
    canvas.loadFromJSON(canvasState, async () => {
      try {
        canvas.forEachObject((obj: any) => {
          if (
            obj.type === 'text' &&
            containsChinese((obj as fabric.IText).text || '')
          ) {
            obj.set('fontFamily', 'SimSun')
          }
        })

        canvas.backgroundColor = 'white'
        canvas.renderAll()

        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 2,
        })
        const base64Data = dataUrl.split(';base64,').pop()
        const buffer = Buffer.from(base64Data!, 'base64')

        const directoryPath = path.join(
          __dirname,
          '..',
          'public',
          'images',
          'personalized_image'
        )
        const filePath = path.join(directoryPath, `${uniqueID}.png`)

        await fs.mkdir(directoryPath, { recursive: true })
        await fs.writeFile(filePath, buffer)

        const imageUrl = `https://ibt3.whatsgenie.com/images/personalized_image/${uniqueID}.png`
        resolve(imageUrl)
      } catch (err) {
        reject(`Error generating image: ${(err as unknown as any).message}`)
      }
    })
  })
}
