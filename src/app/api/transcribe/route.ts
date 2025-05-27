import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Transcribe API endpoint called');

    // Get the FormData from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      console.error('No audio file provided');
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log(
      'Audio file received, size:',
      audioFile.size,
      'type:',
      audioFile.type
    );

    // Create a proper file object from the blob
    const file = new File([audioFile], 'audio.webm', {
      type: audioFile.type || 'audio/webm',
    });

    // Create a new FormData to send to the backend
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('language', 'es');

    // Forward the request to our backend
    const response = await fetch(
      'https://perla-backend-production-6e4d.up.railway.app/transcribe',
      {
        method: 'POST',
        body: backendFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error response:', errorText);

      let errorMessage = `Error ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `Error ${response.status}: ${errorData.error || JSON.stringify(errorData)}`;
      } catch (parseError) {
        errorMessage = `Error ${response.status}: ${errorText.substring(0, 100)}`;
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    // Return the transcription result
    const data = await response.json();

    return NextResponse.json({
      success: true,
      text: data.text,
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
