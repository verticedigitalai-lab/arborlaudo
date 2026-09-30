'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface UploadFotosProps {
  onUploadComplete: (urls: string[]) => void
}

const BUCKET_NAME = 'fotos-arvores' // ⚠️ use o MESMO nome exato do bucket criado no Supabase Storage

export default function UploadFotos({ onUploadComplete }: UploadFotosProps) {
  const [uploading, setUploading] = useState(false)
  const [urls, setUrls] = useState<string[]>([])
  const [erro, setErro] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setErro('')
    setUploading(true)

    const novasUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validação básica de tipo e tamanho (máx 10MB por foto)
      if (!file.type.startsWith('image/')) {
        setErro(`"${file.name}" não é uma imagem válida.`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        setErro(`"${file.name}" excede o tamanho máximo de 10MB.`)
        continue
      }

      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file)

      if (error) {
        console.error('Erro no upload:', error)
        setErro(`Erro ao enviar "${file.name}".`)
        continue
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

      novasUrls.push(publicUrlData.publicUrl)
    }

    const urlsAtualizadas = [...urls, ...novasUrls]
    setUrls(urlsAtualizadas)
    onUploadComplete(urlsAtualizadas)
    setUploading(false)

    // Limpa o input para permitir selecionar os mesmos arquivos novamente se necessário
    e.target.value = ''
  }

  const handleRemove = (urlParaRemover: string) => {
    const urlsAtualizadas = urls.filter((url) => url !== urlParaRemover)
    setUrls(urlsAtualizadas)
    onUploadComplete(urlsAtualizadas)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Fotos da árvore (mín. 2 fotos)
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="block w-full text-sm border border-gray-300 rounded-lg p-2"
      />

      {uploading && <p className="text-sm text-emerald-600">Enviando fotos...</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {urls.length > 0 && (
        <>
          <p className="text-sm text-green-600">{urls.length} foto(s) enviada(s) com sucesso!</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {urls.map((url) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="Foto da árvore"
                  className="w-full h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(url)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                  title="Remover foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
