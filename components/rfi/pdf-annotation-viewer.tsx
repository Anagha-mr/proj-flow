"use client"

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react"
import { Loader2, Pencil, Circle, Square, Type, Trash2 } from "lucide-react"
import type { AnnotationData } from "@/app/actions/rfis"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PDFAnnotationViewerRef {
  getAnnotationData: () => AnnotationData
}

interface PDFAnnotationViewerProps {
  fileUrl: string
  mode: "view" | "annotate" | "respond"
  existingAnnotation?: AnnotationData | null
  existingResponse?: AnnotationData | null
  onAnnotationComplete?: (data: AnnotationData) => void
  height?: number
}

type DrawingTool = "freehand" | "circle" | "rect" | "text"

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRACTOR_COLOR = "#E24B4A"
const DESIGNER_COLOR = "#1D9E75"

const COLOR_PRESETS = [
  { label: "Red",   value: "#E24B4A" },
  { label: "Amber", value: "#BA7517" },
  { label: "Blue",  value: "#3B82F6" },
  { label: "Green", value: "#1D9E75" },
]

// ─── Helper — flatten fabric Path into points array ───────────────────────────

function fabricPathToPoints(fabricPath: { path?: Array<Array<string | number>> }): number[] {
  const points: number[] = []
  for (const cmd of fabricPath.path ?? []) {
    const len = cmd.length
    if (len >= 3) {
      points.push(cmd[len - 2] as number, cmd[len - 1] as number)
    }
  }
  return points
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PDFAnnotationViewer = forwardRef<PDFAnnotationViewerRef, PDFAnnotationViewerProps>(
  function PDFAnnotationViewer(
    { fileUrl, mode, existingAnnotation, existingResponse, height = 600 },
    ref
  ) {
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
    const fabricCanvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabricInstanceRef = useRef<any>(null)
    const [canvasReady, setCanvasReady] = useState(false)
    const [canvasHeight, setCanvasHeight] = useState(height)

    // Tool state — use refs so fabric event closures always see current values
    const [selectedTool, setSelectedTool] = useState<DrawingTool>("freehand")
    const [strokeColor, setStrokeColor] = useState(CONTRACTOR_COLOR)
    const [strokeWidth, setStrokeWidth] = useState(3)
    const selectedToolRef = useRef<DrawingTool>("freehand")
    const strokeColorRef = useRef(CONTRACTOR_COLOR)
    const strokeWidthRef = useRef(3)

    useEffect(() => { selectedToolRef.current = selectedTool }, [selectedTool])
    useEffect(() => { strokeColorRef.current = strokeColor }, [strokeColor])
    useEffect(() => { strokeWidthRef.current = strokeWidth }, [strokeWidth])

    // Undo history — JSON snapshots of canvas state, scoped to this editing session
    const historyRef = useRef<string[]>([])
    const isRestoringRef = useRef(false)
    const HISTORY_LIMIT = 50

    // ── Expose getAnnotationData via ref ──────────────────────────────────────

    useImperativeHandle(ref, () => ({
      getAnnotationData(): AnnotationData {
        const canvas = fabricInstanceRef.current
        if (!canvas) {
          return { shapes: [], canvas_width: 0, canvas_height: 0, pdf_page: 1, created_at: new Date().toISOString() }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const objects: any[] = canvas.getObjects()
        const shapes: AnnotationData["shapes"] = objects.map((obj) => {
          const type: string = obj.type ?? "freehand"

          if (type === "circle") {
            return {
              type: "circle" as const,
              x: obj.left ?? 0,
              y: obj.top ?? 0,
              radius: obj.radius ?? 20,
              color: (obj.stroke as string) ?? strokeColorRef.current,
              strokeWidth: obj.strokeWidth ?? 2,
            }
          }

          if (type === "rect") {
            return {
              type: "rect" as const,
              x: obj.left ?? 0,
              y: obj.top ?? 0,
              width: obj.width ?? 50,
              height: obj.height ?? 50,
              color: (obj.stroke as string) ?? strokeColorRef.current,
              strokeWidth: obj.strokeWidth ?? 2,
            }
          }

          if (type === "i-text" || type === "text") {
            return {
              type: "text" as const,
              x: obj.left ?? 0,
              y: obj.top ?? 0,
              text: obj.text ?? "",
              color: (obj.fill as string) ?? strokeColorRef.current,
              strokeWidth: 0,
              fontSize: obj.fontSize ?? 16,
            }
          }

          // freehand path
          return {
            type: "freehand" as const,
            x: obj.left ?? 0,
            y: obj.top ?? 0,
            points: fabricPathToPoints(obj),
            color: (obj.stroke as string) ?? strokeColorRef.current,
            strokeWidth: obj.strokeWidth ?? 3,
          }
        })

        return {
          shapes,
          canvas_width: canvas.width ?? 0,
          canvas_height: canvas.height ?? 0,
          pdf_page: 1,
          created_at: new Date().toISOString(),
        }
      },
    }))

    // ── Render annotation shapes onto fabric canvas ───────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderAnnotationShapes = useCallback(async (canvas: any, annotation: AnnotationData, color: string) => {
      const { fabric } = await import("fabric")

      for (const shape of annotation.shapes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let obj: any

        if (shape.type === "circle") {
          obj = new fabric.Circle({
            left: shape.x,
            top: shape.y,
            radius: shape.radius ?? 20,
            stroke: color,
            fill: "transparent",
            strokeWidth: shape.strokeWidth,
            selectable: false,
            evented: false,
          })
        } else if (shape.type === "rect") {
          obj = new fabric.Rect({
            left: shape.x,
            top: shape.y,
            width: shape.width ?? 50,
            height: shape.height ?? 50,
            stroke: color,
            fill: "transparent",
            strokeWidth: shape.strokeWidth,
            selectable: false,
            evented: false,
          })
        } else if (shape.type === "text") {
          obj = new fabric.IText(shape.text ?? "", {
            left: shape.x,
            top: shape.y,
            fill: color,
            fontSize: shape.fontSize ?? 16,
            selectable: false,
            evented: false,
          })
        } else {
          // freehand — reconstruct polyline from points
          const pts = shape.points ?? []
          if (pts.length >= 4) {
            let d = `M ${pts[0]} ${pts[1]}`
            for (let i = 2; i < pts.length; i += 2) {
              d += ` L ${pts[i]} ${pts[i + 1]}`
            }
            obj = new fabric.Path(d, {
              left: shape.x,
              top: shape.y,
              stroke: color,
              fill: "transparent",
              strokeWidth: shape.strokeWidth,
              selectable: false,
              evented: false,
            })
          }
        }

        if (obj) canvas.add(obj)
      }

      canvas.renderAll()
    }, [])

    // ── Undo history — snapshot before/after mutating actions ─────────────────
    // selectable/evented are included explicitly since fabric's default toJSON()
    // omits them — without this, undo would make locked shapes selectable again.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pushHistory = useCallback((canvas: any) => {
      if (!canvas || isRestoringRef.current) return
      const snapshot = JSON.stringify(canvas.toJSON(["selectable", "evented"]))
      historyRef.current.push(snapshot)
      if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift()
    }, [])

    const undo = useCallback(() => {
      const canvas = fabricInstanceRef.current
      if (!canvas || historyRef.current.length <= 1) return

      isRestoringRef.current = true
      historyRef.current.pop()
      const prevState = historyRef.current[historyRef.current.length - 1]
      canvas.loadFromJSON(prevState, () => {
        canvas.renderAll()
        isRestoringRef.current = false
      })
    }, [])

    const deleteSelected = useCallback(() => {
      const canvas = fabricInstanceRef.current
      if (!canvas) return
      const activeObj = canvas.getActiveObject()
      if (!activeObj) return

      if (activeObj.type === "activeSelection") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const objects: any[] = activeObj.getObjects ? activeObj.getObjects() : []
        canvas.discardActiveObject()
        objects.forEach((obj) => canvas.remove(obj))
      } else {
        canvas.remove(activeObj)
      }
      canvas.requestRenderAll()
    }, [])

    // ── Keyboard shortcuts — Delete/Backspace to remove, Cmd/Ctrl+Z to undo ────
    // Scoped to skip when the user is typing in any text field (including a
    // fabric IText in edit mode, which focuses its own hidden <textarea>) so
    // this never hijacks an unrelated input elsewhere on the page.

    useEffect(() => {
      if (mode === "view") return

      function isTypingInField(): boolean {
        const el = document.activeElement as HTMLElement | null
        if (!el) return false
        return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
      }

      function handleKeyDown(e: KeyboardEvent) {
        const canvas = fabricInstanceRef.current
        if (!canvas || isTypingInField()) return

        const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z"
        if (isUndo) {
          e.preventDefault()
          undo()
          return
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          if (!canvas.getActiveObject()) return
          e.preventDefault()
          deleteSelected()
        }
      }

      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [mode, undo, deleteSelected])

    // ── Wire mouse/touch events for shape tools ───────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wireShapeEvents = useCallback((canvas: any, onChange: () => void) => {
      let isDrawing = false
      let startX = 0
      let startY = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let currentShape: any = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on("mouse:down", async ({ e, target }: { e: MouseEvent | TouchEvent; target?: any }) => {
        const tool = selectedToolRef.current
        if (tool === "freehand") return

        if (target) {
          // Text tool clicking an existing text object resumes editing it —
          // matches the "click to type" UX used when the text was first
          // created (single click, not fabric's default double-click). Every
          // other tool/target combination defers to fabric's own
          // selection/drag handling instead of drawing a new shape on top of
          // whatever was clicked.
          if (tool === "text" && (target.type === "i-text" || target.type === "text")) {
            canvas.setActiveObject(target)
            target.enterEditing()
            canvas.renderAll()
          }
          return
        }

        // Deselect whatever was previously active so drawing a new shape on
        // top of empty canvas doesn't leave a stray selection behind.
        canvas.discardActiveObject()

        const pointer = canvas.getPointer(e)
        startX = pointer.x
        startY = pointer.y

        if (tool === "text") {
          canvas.isDrawingMode = false
          const { fabric } = await import("fabric")
          const text = new fabric.IText("Type here", {
            left: startX,
            top: startY,
            fill: strokeColorRef.current,
            fontSize: 16,
            selectable: true,
            editable: true,
          })
          // fabric appends its hidden editing textarea to document.body by
          // default, which sits outside the Radix Dialog/Sheet wrapping this
          // canvas — its focus trap then immediately steals focus back since
          // the textarea isn't a descendant of the dialog's content. Scoping
          // it to our own container (which IS inside the dialog) makes the
          // trap's containment check pass naturally, so typing works.
          // (hiddenTextareaContainer is a real fabric v5 IText property, just
          // missing from its own .d.ts — hence the any-cast.)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(text as any).hiddenTextareaContainer = containerRef.current
          canvas.add(text)
          canvas.setActiveObject(text)
          canvas.renderAll()
          onChange()
          setTimeout(() => {
            text.enterEditing()
            text.selectAll()
            canvas.renderAll()
          }, 50)
          return
        }

        isDrawing = true
        const { fabric } = await import("fabric")

        if (tool === "circle") {
          currentShape = new fabric.Circle({
            left: startX,
            top: startY,
            radius: 1,
            stroke: strokeColorRef.current,
            fill: "transparent",
            strokeWidth: strokeWidthRef.current,
            selectable: false,
          })
        } else if (tool === "rect") {
          currentShape = new fabric.Rect({
            left: startX,
            top: startY,
            width: 1,
            height: 1,
            stroke: strokeColorRef.current,
            fill: "transparent",
            strokeWidth: strokeWidthRef.current,
            selectable: false,
          })
        }

        if (currentShape) canvas.add(currentShape)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.on("mouse:move", ({ e }: { e: MouseEvent | TouchEvent }) => {
        if (!isDrawing || !currentShape) return
        const pointer = canvas.getPointer(e)

        const tool = selectedToolRef.current
        if (tool === "circle") {
          const radius = Math.max(
            Math.abs(pointer.x - startX),
            Math.abs(pointer.y - startY)
          ) / 2
          currentShape.set({
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY),
            radius,
          })
        } else if (tool === "rect") {
          currentShape.set({
            left: Math.min(pointer.x, startX),
            top: Math.min(pointer.y, startY),
            width: Math.abs(pointer.x - startX),
            height: Math.abs(pointer.y - startY),
          })
        }

        canvas.renderAll()
      })

      canvas.on("mouse:up", () => {
        isDrawing = false
        if (currentShape) {
          currentShape.setCoords()
          // Newly drawn shapes are non-selectable while being dragged out
          // (avoids fighting fabric's controls mid-draw); make them selectable
          // now that the shape is finalized.
          currentShape.set({ selectable: true, evented: true })
          onChange()
          currentShape = null
        }
      })
    }, [])

    // ── Update fabric drawing mode when tool changes ──────────────────────────

    useEffect(() => {
      const canvas = fabricInstanceRef.current
      if (!canvas || mode === "view") return

      canvas.isDrawingMode = selectedTool === "freehand"
      if (selectedTool === "freehand") {
        canvas.freeDrawingBrush.color = mode === "respond" ? DESIGNER_COLOR : strokeColor
        canvas.freeDrawingBrush.width = strokeWidth
      }
      canvas.renderAll()
    }, [selectedTool, strokeColor, strokeWidth, mode])

    // ── Init PDF.js + fabric.js ───────────────────────────────────────────────

    useEffect(() => {
      if (!fileUrl) return
      let destroyed = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fabricInstance: any = null

      async function init() {
        try {
          // 1. Load PDF.js dynamically
          const pdfjsLib = await import("pdfjs-dist")
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

          // 2. Load and render PDF to the lower canvas
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pdf = await (pdfjsLib as any).getDocument({ url: fileUrl }).promise
          const page = await pdf.getPage(1)
          const viewport = page.getViewport({ scale: 1.5 })

          if (destroyed) return

          const pdfCanvas = pdfCanvasRef.current
          if (!pdfCanvas) return

          pdfCanvas.width = viewport.width
          pdfCanvas.height = viewport.height

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({
            canvasContext: pdfCanvas.getContext("2d")!,
            viewport,
          } as any).promise

          if (destroyed) return

          setCanvasHeight(viewport.height)

          // 3. Load fabric.js dynamically
          const { fabric } = await import("fabric")

          if (destroyed || !fabricCanvasRef.current) return

          const isInteractive = mode !== "view"

          // 4. Create fabric canvas overlay — same dimensions as PDF canvas
          fabricInstance = new fabric.Canvas(fabricCanvasRef.current, {
            width: viewport.width,
            height: viewport.height,
            isDrawingMode: isInteractive && mode !== "respond" ? true : false,
            selection: isInteractive,
          })

          // 5. Fix the fabric wrapper element positioning so it overlays the PDF
          const wrapperEl = fabricInstance.wrapperEl as HTMLElement
          if (wrapperEl) {
            wrapperEl.style.position = "absolute"
            wrapperEl.style.top = "0"
            wrapperEl.style.left = "0"
          }

          // 6. Apply touch-action: none to prevent scroll interference
          const upperCanvas = fabricInstance.upperCanvasEl as HTMLElement
          if (upperCanvas) {
            upperCanvas.style.touchAction = "none"
          }

          // 7. Configure freehand brush
          if (isInteractive && fabricInstance.freeDrawingBrush) {
            const brushColor = mode === "respond" ? DESIGNER_COLOR : CONTRACTOR_COLOR
            fabricInstance.freeDrawingBrush.color = brushColor
            fabricInstance.freeDrawingBrush.width = 3
          }

          // 8. In respond mode, disable drawing by default (show existing first)
          if (mode === "respond") {
            fabricInstance.isDrawingMode = false
          }

          // 9. Render existing annotation shapes (contractor — red, locked)
          if (existingAnnotation?.shapes?.length) {
            await renderAnnotationShapes(fabricInstance, existingAnnotation, CONTRACTOR_COLOR)
          }

          // 10. In respond mode, also show existing response annotation (green, locked)
          if (mode === "view" && existingResponse?.shapes?.length) {
            await renderAnnotationShapes(fabricInstance, existingResponse, DESIGNER_COLOR)
          }

          // 11. In respond mode — enable drawing on top in green
          if (mode === "respond") {
            fabricInstance.isDrawingMode = true
            if (fabricInstance.freeDrawingBrush) {
              fabricInstance.freeDrawingBrush.color = DESIGNER_COLOR
              fabricInstance.freeDrawingBrush.width = 3
            }
          }

          // 12. Wire mouse events for shape tools + undo history tracking
          if (isInteractive) {
            historyRef.current = []
            isRestoringRef.current = false
            const snapshotChange = () => pushHistory(fabricInstance)
            fabricInstance.on("object:modified", snapshotChange)
            fabricInstance.on("path:created", snapshotChange)
            fabricInstance.on("object:removed", snapshotChange)
            // Fired by fabric when an IText editing session ends — captures
            // typed content as its own undo step (text:changed fires per
            // keystroke, which is too granular to snapshot).
            fabricInstance.on("text:editing:exited", snapshotChange)
            wireShapeEvents(fabricInstance, snapshotChange)
            snapshotChange() // baseline snapshot — pre-edit state (locked shapes only)
          }

          fabricInstanceRef.current = fabricInstance

          if (!destroyed) setCanvasReady(true)
        } catch (err) {
          console.error("PDFAnnotationViewer init error:", err)
        }
      }

      init()

      return () => {
        destroyed = true
        try {
          // Explicitly drop our custom canvas.on(...) listeners (object:modified,
          // path:created, object:removed) — dispose() tears down fabric's own
          // internal DOM listeners but isn't guaranteed to clear these too, and
          // this effect re-runs on every mode/fileUrl change.
          fabricInstance?.off()
          fabricInstance?.dispose()
        } catch {
          // ignore dispose errors
        }
        fabricInstanceRef.current = null
        historyRef.current = []
        setCanvasReady(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileUrl, mode])

    // ── Clear all annotation shapes ───────────────────────────────────────────

    const handleClear = useCallback(() => {
      const canvas = fabricInstanceRef.current
      if (!canvas) return

      // In respond mode, only clear designer's objects (keep contractor shapes)
      if (mode === "respond" && existingAnnotation?.shapes?.length) {
        // Remove all selectable/evented objects (designer's drawings)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toRemove = canvas.getObjects().filter((o: any) => o.selectable !== false)
        toRemove.forEach((o: object) => canvas.remove(o))
      } else {
        canvas.clear()
      }
      canvas.renderAll()
    }, [mode, existingAnnotation])

    // ── Render ────────────────────────────────────────────────────────────────

    const canDraw = mode === "annotate" || mode === "respond"
    const showColorPicker = mode === "annotate"

    return (
      <div className="flex flex-col gap-3">
        {/* Canvas container */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-[6px] border border-border-default bg-surface"
          style={{ height: canvasReady ? canvasHeight : height }}
        >
          {/* PDF render layer */}
          <canvas
            ref={pdfCanvasRef}
            className="absolute top-0 left-0 block"
            style={{ zIndex: 0 }}
          />

          {/* fabric canvas element — fabric wraps this with its own container div */}
          <canvas
            ref={fabricCanvasRef}
            style={{ zIndex: 1 }}
          />

          {/* Loading state */}
          {!canvasReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface animate-pulse rounded-[6px]">
              <Loader2 className="animate-spin text-[#e94560]" size={24} />
              <span className="text-sm text-muted-foreground">Loading drawing...</span>
            </div>
          )}
        </div>

        {/* Annotation toolbar — only in draw/respond modes */}
        {canDraw && canvasReady && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-[6px] border border-gray-200">
            {/* Tool buttons */}
            <div className="flex gap-1">
              {([
                { tool: "freehand" as DrawingTool, icon: <Pencil size={13} />, label: "Draw" },
                { tool: "circle"   as DrawingTool, icon: <Circle  size={13} />, label: "Circle" },
                { tool: "rect"     as DrawingTool, icon: <Square  size={13} />, label: "Rect" },
                { tool: "text"     as DrawingTool, icon: <Type    size={13} />, label: "Text" },
              ]).map(({ tool, icon, label }) => (
                <button
                  key={tool}
                  onClick={() => setSelectedTool(tool)}
                  title={label}
                  className={`flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs border transition-colors ${
                    selectedTool === tool
                      ? "bg-[#e94560]/10 border-[#e94560]/40 text-[#e94560]"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Color presets — annotate mode only */}
            {showColorPicker && (
              <div className="flex gap-1 items-center">
                <span className="text-xs text-muted-foreground hidden sm:inline">Color:</span>
                {COLOR_PRESETS.map(({ value, label }) => (
                  <button
                    key={value}
                    title={label}
                    onClick={() => setStrokeColor(value)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      strokeColor === value
                        ? "border-gray-800 scale-125"
                        : "border-transparent hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: value }}
                  />
                ))}
              </div>
            )}

            {/* Stroke width */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">Stroke:</span>
              <input
                type="range"
                min={1}
                max={8}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-16 h-1 accent-[#e94560]"
              />
              <span className="text-xs text-muted-foreground w-4">{strokeWidth}</span>
            </div>

            {/* Clear button */}
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-500 transition-colors ml-auto"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        )}
      </div>
    )
  }
)
