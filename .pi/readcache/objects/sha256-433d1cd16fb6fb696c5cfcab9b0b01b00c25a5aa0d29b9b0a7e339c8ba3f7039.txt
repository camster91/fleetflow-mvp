import { useState, useRef, useEffect } from 'react'
import { Search, Clock, X, ChevronDown } from 'lucide-react'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  recentItems: string[]
  suggestions?: string[]
  placeholder?: string
  label?: string
  icon?: React.ReactNode
  allowNew?: boolean
  onSelect?: (value: string) => void
  className?: string
  disabled?: boolean
}

export default function AutocompleteInput({
  value,
  onChange,
  recentItems,
  suggestions = [],
  placeholder = 'Type to search...',
  label,
  icon,
  allowNew = true,
  onSelect,
  className = '',
  disabled = false
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter suggestions based on input
  const filteredRecent = recentItems.filter(item =>
    item.toLowerCase().includes(inputValue.toLowerCase()) &&
    item.toLowerCase() !== inputValue.toLowerCase()
  ).slice(0, 5)

  const filteredSuggestions = suggestions.filter(item =>
    item.toLowerCase().includes(inputValue.toLowerCase()) &&
    item.toLowerCase() !== inputValue.toLowerCase() &&
    !recentItems.includes(item)
  ).slice(0, 5)

  const hasResults = filteredRecent.length > 0 || filteredSuggestions.length > 0

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onChange(selectedValue)
    onSelect?.(selectedValue)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const allOptions = [...filteredRecent, ...filteredSuggestions]
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIsOpen(true)
        setHighlightedIndex(prev => 
          prev < allOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          handleSelect(allOptions[highlightedIndex])
        } else if (allowNew && inputValue.trim()) {
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  const handleClear = () => {
    setInputValue('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition ${
            icon ? 'pl-10' : ''
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        <ChevronDown 
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (hasResults || !inputValue) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {/* Recent Items Section */}
          {filteredRecent.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              {filteredRecent.map((item, index) => (
                <button
                  key={`recent-${item}`}
                  onClick={() => handleSelect(item)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 ${
                    highlightedIndex === index ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span dangerouslySetInnerHTML={{
                    __html: item.replace(
                      new RegExp(`(${inputValue})`, 'gi'),
                      '<mark class="bg-primary-200 text-primary-900">$1</mark>'
                    )
                  }} />
                </button>
              ))}
            </div>
          )}

          {/* Suggestions Section */}
          {filteredSuggestions.length > 0 && (
            <div>
              {filteredRecent.length > 0 && (
                <div className="border-t border-gray-100" />
              )}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Search className="h-3 w-3" />
                Suggestions
              </div>
              {filteredSuggestions.map((item, index) => (
                <button
                  key={`sugg-${item}`}
                  onClick={() => handleSelect(item)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2 ${
                    highlightedIndex === filteredRecent.length + index ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                  }`}
                >
                  <Search className="h-3 w-3 text-gray-400" />
                  <span dangerouslySetInnerHTML={{
                    __html: item.replace(
                      new RegExp(`(${inputValue})`, 'gi'),
                      '<mark class="bg-primary-200 text-primary-900">$1</mark>'
                    )
                  }} />
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {inputValue && !hasResults && !allowNew && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              No matches found
            </div>
          )}

          {/* Add New Option */}
          {inputValue && allowNew && !recentItems.includes(inputValue) && (
            <div>
              {(filteredRecent.length > 0 || filteredSuggestions.length > 0) && (
                <div className="border-t border-gray-100" />
              )}
              <button
                onClick={() => handleSelect(inputValue)}
                className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 transition"
              >
                + Use "{inputValue}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
