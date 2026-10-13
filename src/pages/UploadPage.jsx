import { useRef, useState } from 'react'
import { getDocumentView, startExtraction, uploadDocument } from '../services/documentApi'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg'])
const POLL_INTERVAL_MS = 500
const MAX_POLL_ATTEMPTS = 60

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

function isImageUpload(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return IMAGE_EXTENSIONS.has(extension)
}

function getActionLabels(fileName) {
  if (isImageUpload(fileName)) {
    return ['Extract', 'PII mask', 'Translate']
  }
  return ['PII mask', 'Translate']
}

function UploadPage() {
  const fileInputRef = useRef(null)
  const activeDocumentIdRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadState, setUploadState] = useState('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [extractionStatus, setExtractionStatus] = useState('NOT_STARTED')
  const [documentId, setDocumentId] = useState(null)

  const openFilePicker = () => {
    if (uploadState !== 'uploading') {
      fileInputRef.current?.click()
    }
  }

  const isImageFile = selectedFile ? isImageUpload(selectedFile.name) : false
  const secondaryActionsEnabled = !isImageFile || extractionStatus === 'SUCCESS'

  const beginUpload = async (file) => {
    if (!file) return

    setSelectedFile(file)
    setUploadState('uploading')
    setUploadProgress(0)
    setExtractionStatus('NOT_STARTED')
    activeDocumentIdRef.current = null

    let progressValue = 0
    const timer = window.setInterval(() => {
      progressValue = Math.min(progressValue + 12 + Math.random() * 18, 96)
      setUploadProgress(Math.round(progressValue))
    }, 180)

    try {
      const result = await uploadDocument(file)
      window.clearInterval(timer)
      activeDocumentIdRef.current = result.documentId
      setDocumentId(result.documentId)
      setUploadProgress(100)
      setUploadState('complete')
    } catch {
      window.clearInterval(timer)
      setUploadState('idle')
      setSelectedFile(null)
      setUploadProgress(0)
      setExtractionStatus('NOT_STARTED')
      setDocumentId(null)
    }
  }

  const handleFileInput = (event) => {
    const file = event.target.files?.[0]
    if (file) beginUpload(file)
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) beginUpload(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const handleExtractClick = async () => {
    if (!documentId || !isImageFile) return

    setExtractionStatus('IN_PROGRESS')

    // Ignore results if the user has uploaded a different file since this started.
    const isStillActive = () => activeDocumentIdRef.current === documentId

    try {
      await startExtraction(documentId)

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (!isStillActive()) return

        const view = await getDocumentView(documentId)
        const status = view?.extraction?.status

        if (status === 'SUCCESS' || status === 'FAILED') {
          if (isStillActive()) setExtractionStatus(status)
          return
        }
        if (status !== 'IN_PROGRESS') break

        await wait(POLL_INTERVAL_MS)
      }

      if (isStillActive()) setExtractionStatus('FAILED')
    } catch {
      if (isStillActive()) setExtractionStatus('FAILED')
    }
  }

  const actionLabels = selectedFile ? getActionLabels(selectedFile.name) : []

  return (
    <section className="upload-page">
      <div
        className={`upload-dropzone ${
          uploadState === 'uploading' ? 'is-uploading' : ''
        } ${uploadState === 'complete' ? 'is-complete' : ''}`}
        onClick={uploadState !== 'uploading' ? openFilePicker : undefined}
        onDragOver={uploadState !== 'uploading' ? handleDragOver : undefined}
        onDrop={uploadState !== 'uploading' ? handleDrop : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && uploadState !== 'uploading') {
            event.preventDefault()
            openFilePicker()
          }
        }}
      >
        <input ref={fileInputRef} type="file" hidden onChange={handleFileInput} />

        {uploadState === 'idle' && (
          <>
            <div className="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" className="upload-svg">
                <path d="M19 40.5h26a8.5 8.5 0 0 0 1.1-16.9A13 13 0 0 0 18 24.8 10.6 10.6 0 0 0 19 40.5Zm7.6-9.8 6.4-6.4 6.4 6.4M33 24.1V39.5" />
              </svg>
            </div>
            <p className="drop-text">Drag &amp; drop a file here, or click to browse</p>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <p className="uploading-label">Uploading... {uploadProgress}%</p>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </>
        )}

        {uploadState === 'complete' && selectedFile && (
          <>
            <div className="complete-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" className="document-svg">
                <path d="M20 12h18l10 10v30a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Zm18 0v10h10" />
                <path d="M25 30h14M25 38h14M25 46h10" />
              </svg>
            </div>
            <p className="complete-text">Upload complete : {selectedFile.name}</p>
            <div className="action-row">
              {actionLabels.map((label) => {
                const isExtract = label === 'Extract'
                const isDisabled = isExtract ? false : !secondaryActionsEnabled
                return (
                  <button
                    key={label}
                    type="button"
                    className={`action-button ${isDisabled ? 'disabled' : ''}`}
                    disabled={isDisabled}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (isExtract) handleExtractClick()
                    }}
                  >
                    <span className="action-symbol" aria-hidden="true">
                      {isExtract ? '◎' : label === 'PII mask' ? '▣' : '⇄'}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default UploadPage
