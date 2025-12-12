'use client'

import { useState, useCallback } from 'react'
import { uploadIssueAttachments } from '@/lib/client-api'

interface PasteImageOptions {
  /**
   * The issue key to upload attachments to.
   * If null, will use onPendingImage callback instead for queuing.
   */
  issueKey: string | null
  /**
   * Callback to insert the attachment token at the current cursor position.
   * Receives the token string and the textarea element.
   */
  onInsert: (token: string, textarea: HTMLTextAreaElement) => void
  /**
   * Callback for when an image is pasted but no issueKey is available.
   * Used for queuing images in new issue creation flow.
   */
  onPendingImage?: (file: File, placeholderId: string) => void
  /**
   * Called when upload starts
   */
  onUploadStart?: () => void
  /**
   * Called when upload ends (success or failure)
   */
  onUploadEnd?: (success: boolean, error?: string) => void
}

interface PasteImageResult {
  /**
   * The paste event handler to attach to a textarea
   */
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  /**
   * Whether an upload is currently in progress
   */
  isUploading: boolean
}

/**
 * Hook to handle pasting images into textareas.
 * When an image is pasted:
 * - If issueKey is provided: uploads immediately and inserts <attachment:{id}> token
 * - If issueKey is null: calls onPendingImage with a placeholder for later upload
 */
export function usePasteImage(options: PasteImageOptions): PasteImageResult {
  const { issueKey, onInsert, onPendingImage, onUploadStart, onUploadEnd } =
    options
  const [isUploading, setIsUploading] = useState(false)

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      // Find image item in clipboard
      let imageFile: File | null = null
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFile = file
            break
          }
        }
      }

      // No image found, let default paste behavior continue
      if (!imageFile) return

      // Prevent default paste behavior for images
      e.preventDefault()

      const textarea = e.currentTarget

      // Generate a filename for the pasted image
      const timestamp = Date.now()
      const extension = imageFile.type.split('/')[1] || 'png'
      const filename = `pasted-image-${timestamp}.${extension}`

      // Create a new file with the proper filename
      const namedFile = new File([imageFile], filename, { type: imageFile.type })

      // If no issueKey, queue the image for later upload
      if (!issueKey) {
        if (onPendingImage) {
          const placeholderId = `pending-${timestamp}`
          onPendingImage(namedFile, placeholderId)
          onInsert(`<pending-image:${placeholderId}>`, textarea)
        }
        return
      }

      // Upload the image
      setIsUploading(true)
      onUploadStart?.()

      try {
        const results = await uploadIssueAttachments(issueKey, [namedFile])

        if (results && results.length > 0) {
          const attachment = results[0]
          const token = `<attachment:${attachment.id}>`
          onInsert(token, textarea)
          onUploadEnd?.(true)
        } else {
          onUploadEnd?.(false, 'Upload returned no results')
        }
      } catch (error) {
        console.error('Error uploading pasted image:', error)
        onUploadEnd?.(
          false,
          error instanceof Error ? error.message : 'Upload failed'
        )
      } finally {
        setIsUploading(false)
      }
    },
    [issueKey, onInsert, onPendingImage, onUploadStart, onUploadEnd]
  )

  return {
    onPaste: handlePaste,
    isUploading
  }
}

/**
 * Helper function to insert text at the current cursor position in a textarea
 * and update the state value.
 */
export function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  setValue: (newValue: string) => void
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentValue = textarea.value

  const newValue = currentValue.slice(0, start) + text + currentValue.slice(end)
  setValue(newValue)

  // Set cursor position after inserted text
  const newCursorPos = start + text.length
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}
