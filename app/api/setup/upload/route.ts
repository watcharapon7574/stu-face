import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST /api/setup/upload - อัพโหลดรูปภาพนักเรียนไปยัง Supabase Storage
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const studentId = formData.get('student_id') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'student_id is required' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${studentId}/${timestamp}.${fileExt}`

    // Upload to Supabase Storage
    const { data, error } = await supabaseServer.storage
      .from('student-photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) throw error

    // Get public URL
    const { data: urlData } = supabaseServer.storage
      .from('student-photos')
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
