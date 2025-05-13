import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import debounce from 'lodash/debounce';
import InfiniteScroll from 'react-infinite-scroll-component';
import TopPanel from './components/TopPanel';
import TopBar from './components/TopBar';
import { Input } from "./components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Search, Filter, ShoppingCart, Loader, X, Menu, SlidersHorizontal, ChartBar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet";
import { Checkbox } from "./components/ui/checkbox";
import { Label } from "./components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import { ScrollArea } from "./components/ui/scroll-area";
import { Slider } from "./components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProductDetails from './components/ProductDetails';
import SearchBar from './components/SearchBar';

// Import the actual page components
import TrendingPage from './components/TrendingPage';
import DealsPage from './components/DealsPage';
import AboutUsPage from './components/AboutUsPage';
import BestsellersPage from './components/BestsellersPage';

function ProductList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 200000]);
  const [maxPrice, setMaxPrice] = useState(200000);
  const [priceHistory, setPriceHistory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortOption, setSortOption] = useState('newest');

  const ITEMS_PER_PAGE = 12;

  const categories = [
    "laptop", "mobile", "headphones", "camera", "television",
    "smartwatch", "tablet", "printer", "router", "gaming laptop"
  ];

  // Initial data fetch
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      handleSearch(initialQuery, true);
    } else {
      fetchProducts();
    }
  }, []);

  // Update max price and price range when products are fetched
  useEffect(() => {
    if (products.length > 0) {
      const prices = products.map(p => parseFloat(getPrice(p))).filter(p => !isNaN(p));
      const highestPrice = Math.max(...prices);
      const roundedMax = Math.ceil(highestPrice / 1000) * 1000;
      setMaxPrice(roundedMax);
      setPriceRange([0, roundedMax]);
    }
  }, [products]);

  // Filter products whenever search term or categories change
  useEffect(() => {
    if (!searchTerm) {
      applyFilters();
    }
  }, [selectedCategories, currentPage, sortOption, priceRange, products]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://127.0.0.1:8000/products");
      setProducts(response.data);
      setFilteredProducts(response.data.slice(0, ITEMS_PER_PAGE));
      setTotalPages(Math.ceil(response.data.length / ITEMS_PER_PAGE));
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again later.");
      setIsLoading(false);
    }
  };

  const fetchPriceHistory = async (product) => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/products/${product.asin}`);
      setPriceHistory(response.data.price_history);
      setSelectedProduct(response.data);
      setIsDialogOpen(true);
    } catch (err) {
      console.error("Error fetching price history:", err);
    }
  };

  const sortProducts = (products, option) => {
    const sorted = [...products];
    switch(option) {
      case 'price-high':
        return sorted.sort((a, b) => parseFloat(getPrice(b)) - parseFloat(getPrice(a)));
      case 'price-low':
        return sorted.sort((a, b) => parseFloat(getPrice(a)) - parseFloat(getPrice(b)));
      case 'discount':
        return sorted.sort((a, b) => {
          const discountA = getDiscount(a)?.match(/\d+/) ?? 0;
          const discountB = getDiscount(b)?.match(/\d+/) ?? 0;
          return parseInt(discountB) - parseInt(discountA);
        });
      case 'newest':
      default:
        return sorted; // Assuming products are already in chronological order
    }
  };

  const applyFilters = () => {
    console.log("Applying filters/sort. Current products count:", products.length);
    let filtered = [...products]; // Start with the current products (full list or search results)

    // Apply category filter
    if (selectedCategories.length > 0) {
      console.log("Applying category filter:", selectedCategories);
      filtered = filtered.filter(product => {
        const category = getCategory(product);
        return selectedCategories.includes(category.toLowerCase());
      });
    }

    // Apply price filter
    console.log("Applying price filter:", priceRange);
    filtered = filtered.filter(product => {
      const price = parseFloat(getPrice(product));
      // Ensure price is a valid number before comparison
      return !isNaN(price) && price >= priceRange[0] && price <= priceRange[1];
    });

    // Apply sorting
    console.log("Applying sort:", sortOption);
    filtered = sortProducts(filtered, sortOption);

    // Calculate total pages based on the *final* filtered list
    const total = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    setTotalPages(total > 0 ? total : 1); // Ensure totalPages is at least 1
    
    // Apply pagination
    // Make sure currentPage is valid for the new totalPages
    const newCurrentPage = Math.min(currentPage, total > 0 ? total : 1);
    if (currentPage !== newCurrentPage) {
        setCurrentPage(newCurrentPage);
    }
    
    const startIndex = (newCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    console.log(`Pagination: Showing items ${startIndex} to ${endIndex-1} from ${filtered.length} total filtered.`);
    setFilteredProducts(filtered.slice(startIndex, endIndex));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = async (query, isInitialLoad = false) => {
    const trimmedQuery = query.trim();
    setSearchTerm(trimmedQuery); // Update state
    if (!isInitialLoad) { 
      setSearchParams(trimmedQuery ? { q: trimmedQuery } : {}); // Update URL
    }
    setCurrentPage(1); // Reset to page 1 on new search
    
    if (!trimmedQuery) {
      // If search is cleared, fetch all products again
      fetchProducts(); 
      return; // Exit early
    }
    
    setIsLoading(true);
    setError(null); // Clear previous errors
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/search?q=${encodeURIComponent(trimmedQuery)}`);
      
      if (res.data && Array.isArray(res.data.results)) {
        // ONLY update the main products state. Filtering/sorting will happen in useEffect/applyFilters
        setProducts(res.data.results);
        // Note: The useEffect watching 'products' will trigger applyFilters
      } else {
        console.log("Search returned no results or invalid data");
        setProducts([]); // Set to empty array if search yields nothing
        setFilteredProducts([]);
        setTotalPages(0);
      }
    } catch (err) {
      console.error("Error searching products:", err);
      setError("Failed to search products. Please try again later.");
      setProducts([]); // Clear products on error
      setFilteredProducts([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
    setCurrentPage(1); // Reset to first page on filter change
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, maxPrice]);
    setCurrentPage(1);
  };

  // Function to safely get image URL from different possible structures
  const getImageUrl = (product) => {
    return product["high_res_image_url"] || 
           product.high_res_image_url || 
           product.imageUrl || 
           product.image || 
           "/api/placeholder/200/200";
  };

  // Function to safely get price from different possible structures
  const getPrice = (product) => {
    const price = product.price || product.raw_price || '0';
    // Clean up price value - remove non-numeric characters except decimal
    return typeof price === 'string' ? price.replace(/[^\d.]/g, '') : price;
  };

  // Function to safely get title from different possible structures
  const getTitle = (product) => {
    return product.title || product.name || product.product_name || 'Unnamed Product';
  };

  // Function to safely get category from different possible structures
  const getCategory = (product) => {
    return (product.category || 'Uncategorized').toLowerCase();
  };

  // Function to safely get discount from different possible structures
  const getDiscount = (product) => {
    return product.raw_discount || product.discount || null;
  };

  const handleCardClick = (product) => {
    navigate(`/product/${product.asin}`);
  };

  const LoadingIndicator = () => (
    <div className="flex justify-center items-center py-4">
      <Loader className="h-6 w-6 animate-spin mr-2" />
      <span>Loading more products...</span>
    </div>
  );

  // Filter/Sort Effect - Simplified: always calls applyFilters when dependencies change
  useEffect(() => {
    console.log("Filter/Sort/Page/Products useEffect triggered. Search term:", searchTerm);
    // applyFilters handles all logic based on current state (products, filters, sort, page)
    applyFilters();
    // We depend on products, selectedCategories, priceRange, sortOption, currentPage
  }, [products, selectedCategories, priceRange, sortOption, currentPage]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      
      <div className="flex">
        {/* Desktop Sidebar - Hidden on mobile */}
        <aside className="hidden md:block w-64 border-r bg-white">
          <div className="h-16 flex items-center px-4 border-b">
            
            <h2 className="text-lg font-semibold">Shop by Category</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4 space-y-4">
              {/* Add Price Range Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Price Range</h3>
                  <div className="text-sm text-gray-500">
                    ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                  </div>
                </div>
                <Slider
                  min={0}
                  max={maxPrice}
                  step={1000}
                  value={priceRange}
                  onValueChange={(value) => {
                    setPriceRange(value);
                    setCurrentPage(1);
                    applyFilters();
                  }}
                  className="my-4"
                />
              </div>
              <Separator className="my-4" />
              
              {categories.map((category) => (
                <div key={category} className="flex items-center">
                  <Checkbox 
                    id={`sidebar-${category}`}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => handleCategoryChange(category)}
                    className="border-2 border-gray-300 rounded-sm h-4 w-4"
                  />
                  <Label 
                    htmlFor={`sidebar-${category}`}
                    className="ml-2 capitalize cursor-pointer flex-1"
                  >
                    {category}
                  </Label>
                </div>
              ))}
              
              {selectedCategories.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <Button 
                    onClick={clearFilters}
                    className="w-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                  >
                    Clear Filters
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <div className="h-16 flex items-center px-4 border-b">
              <h2 className="text-lg font-semibold">Shop by Category</h2>
            </div>
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <div className="p-4 space-y-4">
                {/* Add Price Range Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Price Range</h3>
                    <div className="text-sm text-gray-500">
                      ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={maxPrice}
                    step={1000}
                    value={priceRange}
                    onValueChange={(value) => {
                      setPriceRange(value);
                      setCurrentPage(1);
                      applyFilters();
                    }}
                    className="my-4"
                  />
                </div>
                <Separator className="my-4" />

                {categories.map((category) => (
                  <div key={category} className="flex items-center">
                    <Checkbox 
                      id={`sidebar-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryChange(category)}
                    />
                    <Label 
                      htmlFor={`sidebar-${category}`}
                      className="ml-2 capitalize cursor-pointer flex-1"
                    >
                      {category}
                    </Label>
                  </div>
                ))}
                
                {selectedCategories.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <Button 
                      
                      onClick={clearFilters}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1">
          <TopPanel />
          
          <div className="p-6">
            <div className="w-[1200px] mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden border-2 border-gray-300"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                
                <div className="relative flex-1">
                  <SearchBar 
                    onSearch={handleSearch}
                    onSuggestionClick={handleSearch}
                    isLoading={isLoading}
                    initialSearchTerm={searchTerm}
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/*w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2*/}
                    <Button className="flex items-center gap-2
         bg-black hover:bg-gray-900
         text-white
         border-2 border-gray-300 px-4 py-2 rounded">
                      {sortOption === 'newest' ? 'Newest' : 
                      sortOption === 'price-high' ? 'Price: High to Low' :
                      sortOption === 'price-low' ? 'Price: Low to High' :
                      sortOption === 'discount' ? 'Highest Discount' : 'Relevant'}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setSortOption('newest')}>
                      Newest
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('price-high')}>
                      Price: High to Low
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('price-low')}>
                      Price: Low to High
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('discount')}>
                      Highest Discount
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedCategories.map(category => (
                    <Badge 
                      key={category} 
                      variant="secondary" 
                      className="capitalize py-1 px-2 flex items-center gap-2 bg-gray-100"
                    >
                      {category}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-red-500" 
                        onClick={() => handleCategoryChange(category)}
                      />
                    </Badge>
                  ))}
                  {selectedCategories.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="capitalize py-1 px-2 flex items-center gap-2 bg-gray-100 cursor-pointer hover:bg-gray-200"
                      onClick={clearFilters}
                    >
                      Clear all
                      <X className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
              )}

              {isLoading && products.length === 0 ? (
                <div className="w-full text-center py-12">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading products...</p>
                </div>
              ) : error ? (
                <div className="w-full text-center py-12 text-red-500">{error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-3 gap-5 w-full">
                    {filteredProducts.map((product, index) => (
                      <Card 
                        key={index} 
                        className="flex flex-col h-[550px] border-2 border-gray-200 hover:border-blue-500 transition-colors cursor-pointer"
                        onClick={() => handleCardClick(product)}
                      >
                        <div className="aspect-[4/3] relative bg-white-100 h-[300px]">
                          <div className="absolute inset-0 flex items-center justify-center p-2">
                            <img 
                              src={getImageUrl(product)} 
                              alt={getTitle(product)}
                              className="object-contain w-full h-full" 
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/api/placeholder/200/200";
                              }}
                            />
                          </div>
                          {getCategory(product) && (
                            <Badge className="absolute top-2 left-2 capitalize bg-blue-100 text-blue-800">
                              {getCategory(product)}
                            </Badge>
                          )}
                          {product.hasOwnProperty('availability') && product.availability === false && (
                            <Badge className="absolute top-2 right-2 text-red-600 border-red-600 bg-red-50">
                              Currently not Available
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col">
                          <CardHeader className="pb-2 flex-none">
                            <CardTitle className="text-lg line-clamp-2">{getTitle(product)}</CardTitle>
                          </CardHeader>
                          <CardContent className="flex-none">
                            <div className="flex justify-between items-center">
                              <span className="text-xl font-bold text-gray-900">₹{getPrice(product)}</span>
                              {getDiscount(product) && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  {getDiscount(product)}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter className="mt-auto">
                            <Button 
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchPriceHistory(product);
                              }}
                            >
                              <ChartBar className="h-4 w-4" /> View Price History
                            </Button>
                          </CardFooter>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-center items-center gap-2 mt-8">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="border-2 border-gray-300 bg-black text-white hover:bg-gray-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                                      
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      const halfVisible = Math.floor(maxVisiblePages / 2);
                      
                      let startPage = Math.max(1, currentPage - halfVisible);
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      if (endPage - startPage + 1 < maxVisiblePages) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      if (startPage > 1) {
                        pages.push(
                          <Button
                            key={1}
                            onClick={() => handlePageChange(1)}
                            className="border-2 border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50"
                          >
                            1
                          </Button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span key="start-ellipsis" className="px-2">
                              ...
                            </span>
                          );
                        }
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <Button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`border-2 ${
                              currentPage === i 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {i}
                          </Button>
                        );
                      }
                      
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="end-ellipsis" className="px-2">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <Button
                            key={totalPages}
                            onClick={() => handlePageChange(totalPages)}
                            className="border-2 border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50"
                          >
                            {totalPages}
                          </Button>
                        );
                      }
                      
                      return pages;
                    })()}
                    
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-2 border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold mb-4">
                Price History
              </DialogTitle>
            </DialogHeader>
            {selectedProduct && priceHistory && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.title}
                    className="w-20 h-20 object-contain"
                  />
                  <div>
                    <h3 className="font-medium">{selectedProduct.title}</h3>
                    <p className="text-sm text-gray-500">{selectedProduct.category}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {priceHistory.map((history, index) => {
                    // Format date for display
                    const date = new Date(history.timestamp);
                    const formattedDate = date.toLocaleDateString();
                    const formattedTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    // Determine if this is a price change by comparing with previous entry
                    const isPriceChange = index > 0 && 
                      (history.raw_price !== priceHistory[index-1].raw_price || 
                       history.raw_discount !== priceHistory[index-1].raw_discount);
                    return (
                      <div 
                        key={index}
                        className={`flex justify-between items-center p-3 rounded mb-2 ${isPriceChange ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{history.raw_price}</span>
                          {history.raw_discount && (
                            <Badge variant="outline" className={history.raw_discount.includes('off') ? "text-green-600" : "text-gray-600"}>
                              {history.raw_discount}
                            </Badge>
                          )}
                          {/* Availability badge */}
                          {selectedProduct && selectedProduct.hasOwnProperty('availability') && selectedProduct.availability === false && (
                            <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">
                              Currently not Available
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium">{formattedDate}</span>
                          <span className="text-xs text-gray-500">{formattedTime}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      {/* Footer */}
      <footer className="w-full bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between px-6 gap-6">
          <div className="flex items-center gap-4">
            <img src="/assets/shopmetrics.png" alt="ShopMetrics Logo" className="h-14 w-14 rounded-lg shadow-lg" />
            <span className="text-2xl font-bold tracking-wide">ShopMetrics</span>
          </div>
          <div className="text-center md:text-left text-gray-300 text-sm flex-1">
            <p>&copy; {new Date().getFullYear()} ShopMetrics. All rights reserved.</p>
            <p className="mt-1">This site is not affiliated with Amazon or any other retailer. All trademarks and brands are the property of their respective owners.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <a href="mailto:support@shopmetrics.com" className="text-blue-400 hover:underline">Contact Support</a>
            <a href="#" className="text-gray-400 hover:text-white text-xs">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-white text-xs">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/product/:asin" element={<ProductDetails />} />
        <Route path="/trending" element={<TrendingPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="/bestsellers" element={<BestsellersPage />} />
      </Routes>
    </Router>
  );
}

export default App;