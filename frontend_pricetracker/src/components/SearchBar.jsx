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
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  // Debounced search for suggestions
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length > 1) {
        try {
          setSuggestionError(null); // Clear previous errors
          const res = await axios.get(`${API_BASE_URL}/api/search-suggest?q=${encodeURIComponent(query)}`);
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

  // Added click handler for the button
  const handleButtonClick = () => {
    if (inputValue.trim().length > 0) {
      onSearch(inputValue);
      setSuggestions([]);
    }
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
    <div className="w-full relative">
      <div className="flex items-center">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search products..."
            value={inputValue}
            onChange={handleSearch}
            onKeyDown={handleSearchSubmit}
            className="pl-10 pr-4 border-2 border-gray-300 focus:border-blue-500 w-full"
          />
        </div>
        <Button 
          onClick={handleButtonClick}
          disabled={inputValue.trim().length === 0}
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
        >
          Search
        </Button>
      </div>

      {/* Suggestions dropdown wrapped in full-width container */}
      <div ref={suggestionsRef} className="absolute w-full z-50">
        {suggestions.length > 0 && (
          <ul className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, idx) => (
              <li
                key={idx}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <Search className="h-4 w-4 text-gray-400" />
                <span className="truncate">{suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SearchBar;