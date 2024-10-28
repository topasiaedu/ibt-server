import { fabric } from 'fabric'
import { Contact } from '../db/contacts'
import supabase from '../db/supabaseClient'

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

  const uniqueID = Math.random().toString(36).substring(7)
  const width = canvasState.width || 500
  const height = canvasState.height || 500

  let canvas: fabric.StaticCanvas

  try {
    // Create a new Fabric canvas with dynamic dimensions
    canvas = new fabric.StaticCanvas(null, { width, height, backgroundColor: 'white' })
  } catch (err) {
    console.error('Error during StaticCanvas initialization:', err)
    throw err
  }

  // Correct object types in canvasState before loading
  canvasState.objects = canvasState.objects.map((object: any) => {
    if (object.type === 'Rect') object.type = 'rect'
    if (object.type === 'Textbox') object.type = 'textbox'
    if (object.type === 'textbox') {
      const text = object.text.replace(/%name%/g, contact.name)
      return { ...object, text }
    }
    return object
  })

  return new Promise((resolve, reject) => {
    canvas.loadFromJSON(canvasState, async () => {
      try {
        console.log('Loaded from JSON')

        // Check all text and textbox objects for Chinese characters
        canvas.forEachObject((obj: any) => {
          if (obj.type === 'text' || obj.type === 'textbox') {
            const text = (obj as fabric.IText).text || ''
        
            if (containsChinese(text)) {
              // Use a list of fallback fonts, Fabric.js will pick the first available one
              obj.set('fontFamily', 'Noto Sans CJK, WenQuanYi Zen Hei, Arial') // Use the installed Chinese fonts, with Arial as final fallback
            } else {
              obj.set('fontFamily', 'Arial') // Default font for non-Chinese characters
            }
          }
        })
        
        

        canvas.renderAll()

        const canvasDataURL = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 2,
        })

        const byteString = atob(canvasDataURL.split(',')[1])
        const mimeString = canvasDataURL
          .split(',')[0]
          .split(':')[1]
          .split(';')[0]
        const arrayBuffer = new ArrayBuffer(byteString.length)
        const uint8Array = new Uint8Array(arrayBuffer)

        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i)
        }

        const blob = new Blob([uint8Array], { type: mimeString })

        // Step 2: Upload the image to Supabase
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(`templates/${uniqueID}.png`, blob, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) {
          throw new Error(
            'Error uploading image to Supabase: ' + uploadError.message
          )
        }

        const imageUrl = `https://yvpvhbgcawvruybkmupv.supabase.co/storage/v1/object/public/media/templates/${uniqueID}.png`
        resolve(imageUrl)
      } catch (err) {
        reject(`Error generating image: ${(err as unknown as any).message}`)
      }
    })
  })
}
