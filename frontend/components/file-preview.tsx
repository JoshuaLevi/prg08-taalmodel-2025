import { FileIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FilePreviewProps {
  file: File
  onRemove: () => void
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  return (
    <div className="flex items-center gap-2 bg-card border rounded-md p-2 shadow-sm text-card-foreground">
      <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
        <FileIcon className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">PDF Document</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-secondary hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive focus-visible:ring-offset-1 flex-shrink-0"
        onClick={onRemove}
        title="Bestand verwijderen"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

