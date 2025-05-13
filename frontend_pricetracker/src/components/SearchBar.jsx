import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';
import { debounce } from 'lodash';
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const SearchBar = ({ 
  onSearch, 
  onSuggestionClick,
  isLoading = false,
  className = "",
  initialSearchTerm = ""
}) => {
  const [inputValue, setInputValue] = useState(initialSearchTerm);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search for suggestions
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length > 1) {
        try {
          setSuggestionError(null); // Clear previous errors
          const res = await axios.get(`http://127.0.0.1:8000/api/search-suggest?q=${encodeURIComponent(query)}`);
          setSuggestions(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error("Error fetching suggestions:", err);
          setSuggestions([]);
          setSuggestionError("Could not load suggestions.");
        }
      } else {
        setSuggestions([]);
        setSuggestionError(null);
      }
    }, 300),
    []
  );

  const handleSearch = (e) => {
    const query = e.target.value;
    console.log('[SearchBar] handleSearch - query:', query);
    setInputValue(query);
    
    if (query.length > 1) {
      debouncedSearch(query);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearchSubmit = async (e) => {
    if (e.key === 'Enter' && inputValue.trim().length > 0) {
      e.preventDefault();
      setSuggestions([]);
      onSearch(inputValue);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    setSuggestions([]);
    onSuggestionClick(suggestion);
  };

  // Effect to update internal state if the prop changes (e.g., from URL)
  useEffect(() => {
    console.log('[SearchBar] initialSearchTerm prop changed:', initialSearchTerm);
    setInputValue(initialSearchTerm);
  }, [initialSearchTerm]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    console.log('[SearchBar] inputValue updated:', inputValue);
  }, [inputValue]);

  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search products..."
          value={inputValue}
          onChange={handleSearch}
          onKeyDown={handleSearchSubmit}
          className="pl-10 pr-4 border-2 border-gray-300 focus:border-blue-500"
        />
        <Button 
          onClick={() => onSearch(inputValue)}
          disabled={!inputValue.trim() || isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Search
        </Button>
      </div>
      
      {/* Enhanced suggestions dropdown */}
      {suggestions.length > 0 && (
        <ul 
          ref={suggestionsRef}
          className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-80 overflow-y-auto divide-y divide-gray-100"
        >
          {suggestions.map((suggestion, idx) => (
            <li
              key={idx}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center group"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <Search className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0 group-hover:text-blue-500" />
              <span className="text-sm text-gray-700 group-hover:text-blue-600 line-clamp-1">
                {suggestion}
              </span>
            </li>
          ))}
        </ul>
      )}
      {suggestionError && (
        <div 
          ref={suggestionsRef} // Keep ref for click outside to work
          className="absolute z-10 left-0 right-0 bg-white border border-red-300 rounded-md shadow-lg mt-1 p-4 text-center text-red-600"
        >
          {suggestionError}
        </div>
      )}
    </div>
  );
};

export default SearchBar;