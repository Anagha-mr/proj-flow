"use client"

import { useState } from "react"
import { MoreVertical, Eye, EyeOff, Trash2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns"
import type { SiteUpdate } from "@/app/actions/site"

const PHASE_BADGE: Record<string, string> = {
  before: "bg-blue-100 text-blue-700",
  during: "bg-amber-100 text-amber-700",
  after: "bg-green-100 text-green-700",
}

interface SiteUpdateCardProps {
  update: SiteUpdate
  onToggleVisible: () => void
  onDelete: () => void
  canDelete: boolean
}

export function SiteUpdateCard({ update, onToggleVisible, onDelete, canDelete }: SiteUpdateCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState<string>("")

  const mainPhoto = update.photos[0]

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {/* Photo */}
        <div
          className="relative w-full cursor-pointer bg-gray-50"
          style={{ aspectRatio: "4/3" }}
          onClick={() => { if (mainPhoto) { setActivePhoto(mainPhoto); setLightboxOpen(true) } }}
        >
          {mainPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainPhoto}
              alt="site update"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              No photo
            </div>
          )}
          {update.photos.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              +{update.photos.length - 1}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {update.phase_tag && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_BADGE[update.phase_tag] ?? ""}`}>
                {update.phase_tag}
              </span>
            )}
            {update.space_tag && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {update.space_tag}
              </span>
            )}
          </div>

          {/* Status note */}
          {update.status_note && (
            <p className="text-sm text-gray-700 line-clamp-2 mb-2">{update.status_note}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(update.submitted_at), { addSuffix: true })}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${update.is_client_visible ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {update.is_client_visible ? "Client visible" : "Internal"}
              </span>
            </div>

            {/* 3-dot menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-gray-100 transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onToggleVisible} className="cursor-pointer">
                  {update.is_client_visible ? (
                    <><EyeOff className="w-4 h-4 mr-2" /> Hide from client</>
                  ) : (
                    <><Eye className="w-4 h-4 mr-2" /> Show to client</>
                  )}
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-600 focus:text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-4xl w-full p-0 bg-black border-0"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }}
            className="absolute top-3 right-3 z-10 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activePhoto}
            alt="site update"
            className="w-full max-h-[80vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {update.photos.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto bg-black/80" onClick={(e) => e.stopPropagation()}>
              {update.photos.map((photo, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={photo}
                  alt={`photo ${idx + 1}`}
                  onClick={() => setActivePhoto(photo)}
                  className={`h-16 w-16 object-cover rounded cursor-pointer shrink-0 ${photo === activePhoto ? "ring-2 ring-[#e94560]" : "opacity-70"}`}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
