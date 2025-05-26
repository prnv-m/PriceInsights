import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader, AlertCircle, Tag, Eye, ArrowDown } from "lucide-react";
import { Button } from "./ui/button";
import TopBar from './TopBar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const getImageUrl = (product) => product.high_res_image_url || product.image_url || "/api/placeholder/200/200";
const getPrice = (product) => product.raw_price || 'N/A';
const getTitle = (product) => product.title || 'Unnamed Product';
const getCategory = (product) => (product.category || 'Uncategorized').toLowerCase();
const getDiscount = (product) => product.raw_discount || null;

export default function DealsPage() {
  const navigate = useNavigate();
  const [dealsProducts, setDealsProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDealsProducts();
  }, []);

  const fetchDealsProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products/deals`);
      setDealsProducts(response.data);
    } catch (err) {
      console.error("Error fetching deals products:", err);
      setError("Failed to load today's deals. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (product) => {
    navigate(`/product/${product.asin}`);
  };

  // Function to format the price drop percentage
  const formatDiscountPercentage = (percentage) => {
    return percentage ? `${percentage.toFixed(1)}% Drop` : null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
            <Tag className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold tracking-tight">Today's Deals</h1>
        </div>
        <p className="text-gray-600 mb-8">Products with the biggest price drops recently.</p>

        {isLoading ? (
          <div className="w-full text-center py-12">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-green-600" />
            <p>Loading today's deals...</p>
          </div>
        ) : error ? (
          <div className="w-full text-center py-12 text-red-500 flex flex-col items-center gap-4">
            <AlertCircle className="h-10 w-10" />
            <p>{error}</p>
            <Button onClick={fetchDealsProducts} variant="outline">Retry</Button>
          </div>
        ) : dealsProducts.length === 0 ? (
            <div className="w-full text-center py-12 text-gray-500">
                <p>No major deals found right now. Check back later!</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {dealsProducts.map((product) => (
              <Card 
                key={product.asin} 
                className="flex flex-col h-full border-2 border-gray-200 hover:border-green-500 transition-colors cursor-pointer overflow-hidden"
                onClick={() => handleCardClick(product)}
              >
                <div className="aspect-square relative bg-white p-2">
                  <img 
                    src={getImageUrl(product)} 
                    alt={getTitle(product)}
                    className="object-contain w-full h-full" 
                    onError={(e) => { e.target.onerror = null; e.target.src = "/api/placeholder/200/200"; }}
                  />
                  {getCategory(product) && (
                    <Badge className="absolute top-2 left-2 capitalize bg-blue-100 text-blue-800 text-xs">
                      {getCategory(product)}
                    </Badge>
                  )}
                  {/* Show discount percentage badge */}
                  {formatDiscountPercentage(product.discount_percentage) && (
                      <Badge variant="destructive" className="absolute top-2 right-2 text-xs bg-red-100 text-red-700 border-red-300 flex items-center gap-1">
                          <ArrowDown className="h-3 w-3" />
                          {formatDiscountPercentage(product.discount_percentage)}
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
                      {/* Optionally show the regular discount badge if available */}
                      {getDiscount(product) && (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                          {getDiscount(product)}
                        </Badge>
                      )}
                    </div>
                    {/* Show previous price if available */}
                     {product.previous_numeric_price && (
                       <span className="text-sm text-gray-500 line-through mt-1">
                         Was: {product.previous_numeric_price.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                         {/* Adjust currency/locale as needed */} 
                       </span>
                     )}
                  </CardContent>
                  <CardFooter className="p-0 mt-auto pt-4">
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/product/${product.asin}`);
                      }}
                    >
                      <Eye className="h-4 w-4" /> View Deal
                    </Button>
                  </CardFooter>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 