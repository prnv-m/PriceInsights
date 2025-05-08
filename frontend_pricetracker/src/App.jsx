import { useEffect, useState } from 'react';
import axios from 'axios';
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

function App() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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
    fetchProducts();
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
    applyFilters();
  }, [searchTerm, selectedCategories, products, currentPage]);

  // Trigger filtering when sort option changes
  useEffect(() => {
    applyFilters();
  }, [sortOption]);

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
    let filtered = [...products];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product => {
        const title = getTitle(product);
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product => {
        const category = getCategory(product);
        return selectedCategories.includes(category.toLowerCase());
      });
    }

    // Apply price filter
    filtered = filtered.filter(product => {
      const price = parseFloat(getPrice(product));
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Apply sorting
    filtered = sortProducts(filtered, sortOption);

    // Calculate total pages
    const total = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    setTotalPages(total);

    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setFilteredProducts(filtered.slice(startIndex, endIndex));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
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
    return product["image-url"] || 
           product.image_url || 
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

  const LoadingIndicator = () => (
    <div className="flex justify-center items-center py-4">
      <Loader className="h-6 w-6 animate-spin mr-2" />
      <span>Loading more products...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add TopBar at the very top */}
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
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="pl-10 pr-4 border-2 border-gray-300 focus:border-blue-500"
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="flex items-center gap-2 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700">
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
                      <Card key={index} className="flex flex-col h-[550px] border-2 border-gray-200 hover:border-blue-500 transition-colors">
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
                              onClick={() => fetchPriceHistory(product)}
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
                      variant="outline"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-2 border-gray-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => handlePageChange(page)}
                        className={`${
                          currentPage === page 
                            ? 'bg-blue-600 text-white' 
                            : 'border-2 border-gray-300 text-gray-700'
                        }`}
                      >
                        {page}
                      </Button>
                    ))}
                    
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-2 border-gray-300"
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
    </div>
  );
}

export default App;