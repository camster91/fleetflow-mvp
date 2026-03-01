import React, { useRef, useState } from 'react';
import { Upload, X, File, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  onUpload: (files: File[]) => void;
  onError?: (error: string) => void;
  preview?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize = 5 * 1024 * 1024, // 5MB default
  multiple = false,
  onUpload,
  onError,
  preview = true,
  className = '',
  children,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url?: string }[]>([]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size exceeds ${(maxSize / 1024 / 1024).toFixed(1)}MB limit`;
    }
    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const isAccepted = acceptedTypes.some(type => {
        if (type.includes('*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type;
      });
      if (!isAccepted) {
        return `File type not accepted. Please upload: ${accept}`;
      }
    }
    return null;
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0 && onError) {
      onError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      onUpload(validFiles);
      
      if (preview) {
        const newPreviews = validFiles.map(file => {
          if (file.type.startsWith('image/')) {
            return { file, url: URL.createObjectURL(file) };
          }
          return { file };
        });
        setPreviews(prev => (multiple ? [...prev, ...newPreviews] : newPreviews));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input value to allow re-uploading same file
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removePreview = (index: number) => {
    setPreviews(prev => {
      const newPreviews = [...prev];
      if (newPreviews[index].url) {
        URL.revokeObjectURL(newPreviews[index].url!);
      }
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors
          ${dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        
        {children || (
          <div className="text-center">
            <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {accept ? `Accepted: ${accept}` : 'Any file type'}
              {maxSize && ` • Max ${(maxSize / 1024 / 1024).toFixed(0)}MB`}
            </p>
          </div>
        )}
      </div>

      {/* Previews */}
      {preview && previews.length > 0 && (
        <div className="mt-4 space-y-2">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg"
            >
              {preview.url ? (
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="h-10 w-10 object-cover rounded"
                />
              ) : (
                <div className="h-10 w-10 bg-slate-200 rounded flex items-center justify-center">
                  <File className="h-5 w-5 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {preview.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(preview.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => removePreview(index)}
                className="p-1 hover:bg-slate-200 rounded"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
