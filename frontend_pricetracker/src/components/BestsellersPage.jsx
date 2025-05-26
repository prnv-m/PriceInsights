import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader, AlertCircle, Star, Eye } from "lucide-react"; // Changed icon to Star for Bestseller
import { Button } from "./ui/button";
import TopBar from './TopBar';

// Helper functions (reuse or move to utils if not already done)
const getImageUrl = (product) => product.high_res_image_url || product.image_url || "/api/placeholder/200/200";
const getPrice = (product) => product.raw_price || 'N/A';
const getTitle = (product) => product.title || 'Unnamed Product';
const getCategory = (product) => (product.category || 'Uncategorized').toLowerCase();
const getDiscount = (product) => product.raw_discount || null;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export default function BestsellersPage() {
  const navigate = useNavigate();
  const [bestsellerProducts, setBestsellerProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBestsellerProducts();
  }, []);

  const fetchBestsellerProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products/bestsellers`);
      setBestsellerProducts(response.data);
    } catch (err) {
      console.error("Error fetching bestseller products:", err);
      setError("Failed to load bestseller products. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (product) => {
    navigate(`/product/${product.asin}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
            <Star className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold tracking-tight">Bestseller Products</h1>
        </div>
        <p className="text-gray-600 mb-8">Our current bestselling items, offering great value based on their price history.</p>

        {isLoading ? (
          <div className="w-full text-center py-12">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-yellow-500" />
            <p>Loading bestseller products...</p>
          </div>
        ) : error ? (
          <div className="w-full text-center py-12 text-red-500 flex flex-col items-center gap-4">
            <AlertCircle className="h-10 w-10" />
            <p>{error}</p>
            <Button onClick={fetchBestsellerProducts} variant="outline">Retry</Button>
          </div>
        ) : bestsellerProducts.length === 0 ? (
            <div className="w-full text-center py-12 text-gray-500">
                <p>No bestseller products found at the moment. Check back soon!</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {bestsellerProducts.map((product) => (
              <Card 
                key={product.asin} 
                className="flex flex-col h-full border-2 border-gray-200 hover:border-yellow-500 transition-colors cursor-pointer overflow-hidden"
                onClick={() => handleCardClick(product)}
              >
                <div className="aspect-square relative bg-white p-2">
                  <img 
                    src={getImageUrl(product)} 
                    alt={getTitle(product)}
                    className="object-contain w-full h-full" 
                    onError={(e) => { e.target.onerror = null; e.target.src = "/api/placeholder/200/200"; }}
                  />
                  {/* Bestseller Badge */}
                  <Badge className="absolute top-2 left-2 capitalize bg-yellow-400 text-yellow-900 text-xs font-semibold flex items-center gap-1">
                    <Star className="h-3 w-3" /> Bestseller
                  </Badge>
                  {product.effective_discount_percentage > 0 && (
                     <Badge variant="secondary" className="absolute top-2 right-2 text-xs bg-green-100 text-green-800">
                        {product.effective_discount_percentage.toFixed(0)}% Off Peak
                      </Badge>
                  )}
                  {product.hasOwnProperty('availability') && product.availability === false && (
                    <Badge className="absolute bottom-2 left-2 text-red-600 border-red-600 bg-red-50 text-xs">
                      Currently Unavailable
                    </Badge>
                  )}
                </div>
                <div className="flex-1 flex flex-col p-4">
                  <CardHeader className="p-0 pb-2 flex-none">
                    <CardTitle className="text-base font-medium line-clamp-2">{getTitle(product)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-none mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">{getPrice(product)}</span>
                      {getDiscount(product) && (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                          {getDiscount(product)}
                        </Badge>
                      )}
                    </div>
                    {product.max_historic_price_numeric && product.current_numeric_price < product.max_historic_price_numeric && (
                       <span className="text-sm text-gray-500 line-through mt-1">
                         Peak: {product.max_historic_price_numeric.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                       </span>
                     )}
                  </CardContent>
                  <CardFooter className="p-0 mt-auto pt-4">
                    <Button 
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-2 text-sm"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click when clicking button
                        navigate(`/product/${product.asin}`);
                      }}
                    >
                      <Eye className="h-4 w-4" /> View Product
                    </Button>
                  </CardFooter>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Consider adding a footer */}
    </div>
  );
} 