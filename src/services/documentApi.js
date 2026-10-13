const documents = {}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

function createExtractionRecord() {
  return { status: 'NOT_STARTED', triggeredByUser: false, startedAt: null, completedAt: null }
}
function createPiiRecord() {
  return { status: 'NOT_STARTED', triggeredByUser: false, startedAt: null, completedAt: null }
}
function createTranslationRecord(targetLanguage) {
  return { targetLanguage, status: 'NOT_STARTED', triggeredByUser: false, startedAt: null, completedAt: null }
}

function beginSilentExtraction(document) {
  if (!document) return
  if (!document.extraction) document.extraction = createExtractionRecord()
  if (['IN_PROGRESS', 'SUCCESS', 'FAILED'].includes(document.extraction.status)) return

  document.extraction.status = 'IN_PROGRESS'
  document.extraction.triggeredByUser = false
  document.extraction.startedAt = new Date().toISOString()
  document.currentAction = 'EXTRACTING'

  setTimeout(() => {
    const nextStatus = Math.random() < 0.15 ? 'FAILED' : 'SUCCESS'
    document.extraction.status = nextStatus
    document.extraction.completedAt = new Date().toISOString()
    document.currentAction = nextStatus === 'SUCCESS' ? 'EXTRACTED' : 'FAILED'
  }, 1200)
}

function beginExtraction(document, { triggeredByUser = true } = {}) {
  if (!document) return
  if (!document.extraction) document.extraction = createExtractionRecord()
  if (['IN_PROGRESS', 'SUCCESS', 'FAILED'].includes(document.extraction.status)) return

  document.extraction.status = 'IN_PROGRESS'
  document.extraction.triggeredByUser = triggeredByUser
  document.extraction.startedAt = new Date().toISOString()
  document.currentAction = 'EXTRACTING'

  setTimeout(() => {
    const nextStatus = Math.random() < 0.15 ? 'FAILED' : 'SUCCESS'
    document.extraction.status = nextStatus
    document.extraction.completedAt = new Date().toISOString()
    document.currentAction = nextStatus === 'SUCCESS' ? 'EXTRACTED' : 'FAILED'
  }, 1200)
}

function ensureTranslationRecord(document, targetLanguage) {
  if (!document.translations) document.translations = []
  const existing = document.translations.find((t) => t.targetLanguage === targetLanguage)
  if (existing) return existing
  const record = createTranslationRecord(targetLanguage)
  document.translations.push(record)
  return record
}

function beginTranslation(document, targetLanguage, { triggeredByUser = true } = {}) {
  if (!document) return
  const record = ensureTranslationRecord(document, targetLanguage)
  if (['IN_PROGRESS', 'SUCCESS', 'FAILED'].includes(record.status)) return

  record.status = 'IN_PROGRESS'
  record.triggeredByUser = triggeredByUser
  record.startedAt = new Date().toISOString()
  document.currentAction = 'TRANSLATING'

  setTimeout(() => {
    const nextStatus = Math.random() < 0.15 ? 'FAILED' : 'SUCCESS'
    record.status = nextStatus
    record.completedAt = new Date().toISOString()
    document.currentAction = nextStatus === 'SUCCESS' ? 'TRANSLATED' : 'FAILED'
  }, 1600)
}

function beginPiiDetection(document, { triggeredByUser = true } = {}) {
  if (!document) return
  if (!document.piiResult) document.piiResult = createPiiRecord()
  if (['IN_PROGRESS', 'SUCCESS', 'FAILED'].includes(document.piiResult.status)) return

  document.piiResult.status = 'IN_PROGRESS'
  document.piiResult.triggeredByUser = triggeredByUser
  document.piiResult.startedAt = new Date().toISOString()
  document.currentAction = 'DETECTING_PII'

  setTimeout(() => {
    const nextStatus = Math.random() < 0.15 ? 'FAILED' : 'SUCCESS'
    document.piiResult.status = nextStatus
    document.piiResult.completedAt = new Date().toISOString()
    document.currentAction = nextStatus === 'SUCCESS' ? 'PII_DETECTED' : 'FAILED'
  }, 1500)
}

export async function uploadDocument(file) {
  await wait(1200)
  const documentId = crypto.randomUUID()
  const uploadedAt = new Date().toISOString()

  const document = {
    documentId,
    originalFileName: file.name,
    originalS3Key: `documents/${documentId}/${file.name}`,
    uploadedAt,
    currentAction: 'UPLOADED',
    extraction: createExtractionRecord(),
    translations: [],
    piiResult: createPiiRecord(),
  }

  documents[documentId] = document

  return { documentId, originalFileName: file.name, status: 'UPLOADED', uploadedAt }
}

export async function startExtraction(documentId) {
  await wait(900)
  const document = documents[documentId]
  if (!document) return { documentId, status: 'EXTRACTING' }
  beginExtraction(document, { triggeredByUser: true })
  return { documentId, status: 'EXTRACTING' }
}

export async function startTranslation(documentId, targetLanguages = []) {
  await wait(900)
  const document = documents[documentId]
  if (!document) return { documentId, status: 'TRANSLATING', targetLanguages }

  if (!document.extraction || document.extraction.status !== 'SUCCESS') {
    beginSilentExtraction(document)
  }

  const languages = Array.isArray(targetLanguages) ? targetLanguages : []
  languages.forEach((language) => {
    beginTranslation(document, language, { triggeredByUser: true })
  })

  return { documentId, status: 'TRANSLATING', targetLanguages: languages }
}

export async function startPiiDetection(documentId) {
  await wait(900)
  const document = documents[documentId]
  if (!document) return { documentId, status: 'DETECTING_PII' }

  if (!document.extraction || document.extraction.status !== 'SUCCESS') {
    beginSilentExtraction(document)
  }

  beginPiiDetection(document, { triggeredByUser: true })
  return { documentId, status: 'DETECTING_PII' }
}

export async function getDocumentView(documentId) {
  await wait(300)
  const document = documents[documentId]
  if (!document) return null

  const extraction = document.extraction && document.extraction.triggeredByUser
    ? { ...document.extraction } : null
  const translations = (document.translations || [])
    .filter((t) => t.triggeredByUser).map((t) => ({ ...t }))
  const piiResult = document.piiResult && document.piiResult.triggeredByUser
    ? { ...document.piiResult } : null

  return {
    documentId: document.documentId,
    originalFileName: document.originalFileName,
    originalS3Key: document.originalS3Key,
    uploadedAt: document.uploadedAt,
    currentAction: document.currentAction,
    extraction,
    translations,
    piiResult,
  }
}

export { documents }
