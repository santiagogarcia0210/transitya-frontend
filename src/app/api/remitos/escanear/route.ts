import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Analizá esta imagen de un remito de combustible.
Extraé los siguientes datos y devolvé SOLO un objeto JSON sin markdown ni explicaciones:

{
  "nroRemito": "número de remito o null",
  "razonSocial": "nombre o razón social del destinatario o null",
  "cuit": "CUIT del destinatario (solo números y guiones) o null",
  "fecha": "fecha en formato YYYY-MM-DD o null",
  "combustible": número de litros como número o null,
  "tipoCombustible": "nafta super | nafta premium | diesel | gasoil | GNC | otro o null",
  "monto": importe total en pesos como número sin símbolos o null
}

Si no encontrás algún dato, usá null para ese campo. Solo JSON, sin texto adicional.`;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('comprobante');

    if (!(file instanceof File)) {
      return Response.json({ error: 'Archivo comprobante requerido' }, { status: 400 });
    }

    if (file.type === 'application/pdf') {
      return Response.json({ error: 'PDF no soportado para escaneo. Usá una imagen (JPG, PNG, WEBP).' }, { status: 422 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'No se pudo extraer datos del comprobante' }, { status: 422 });
    }

    const datos = JSON.parse(jsonMatch[0]);
    return Response.json(datos);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return Response.json({ error: message }, { status: 500 });
  }
}
