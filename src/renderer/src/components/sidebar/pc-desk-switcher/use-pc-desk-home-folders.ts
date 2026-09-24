import { useCallback, useEffect, useState } from 'react'
import type { PcDeskHomeFolderListing } from '../../../../../shared/pc-desk-home-folder-types'

const EMPTY_LISTING: PcDeskHomeFolderListing = { rootPath: '', entries: [] }

/** Re-reads the home folder every time the switcher opens, so new folders show up without a restart. */
export function usePcDeskHomeFolders(open: boolean): {
  listing: PcDeskHomeFolderListing
  loading: boolean
} {
  const [listing, setListing] = useState<PcDeskHomeFolderListing>(EMPTY_LISTING)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setListing(await window.api.repos.listPcDeskHomeFolders())
    } catch (error) {
      setListing({
        ...EMPTY_LISTING,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void load()
    }
  }, [open, load])

  return { listing, loading }
}
