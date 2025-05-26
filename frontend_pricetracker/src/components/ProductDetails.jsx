import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import TopBar from './TopBar';
import TopPanel from './TopPanel';
import SearchBar from "./SearchBar";

// Use the same API_BASE_URL as App.jsx
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ProductDetails() {
  const { asin } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [prediction, setPrediction] = useState("");  // New state for prediction

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/products/${asin}`);
        setProduct(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product details");
        setLoading(false);
      }
    };

    fetchProduct();
  }, [asin]);

// New effect to fetch prediction from API endpoint
useEffect(() => {
  const fetchPrediction = async () => {
    if (!product) return;
    
    try {
      setPrediction("Loading prediction...");
      const response = await axios.get(`${API_BASE_URL}/product/${asin}/predictprice?forecast_days=2`);
      
      if (response.data) {
        setPrediction(response.data);
      } else {
        setPrediction("No prediction data available");
      }
    } catch (err) {
      console.error("Error fetching prediction:", err);
      
      if (err.response?.status === 404) {
        setPrediction("Prediction not available for this product");
      } else if (err.response?.status >= 500) {
        setPrediction("Server error - prediction temporarily unavailable");
      } else {
        setPrediction("Unable to load price prediction");
      }
    }
  };

  fetchPrediction();
}, [asin, product]);
  // Helper function to safely parse price
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    // Remove currency symbol, commas and any other non-numeric characters except decimal
    const cleanPrice = priceStr.toString().replace(/[^\d.]/g, '');
    const price = parseFloat(cleanPrice);
    return isNaN(price) ? 0 : price;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen">
        <p className="text-red-500 mb-4">{error || "Product not found"}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // Calculate price statistics with safe parsing
  const prices = product.price_history.map(h => parsePrice(h.raw_price)).filter(price => price > 0);
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // Format price history data for the chart with safe parsing and sort by timestamp ascending
  const chartData = product.price_history
    .map(history => ({
      date: new Date(history.timestamp).toLocaleDateString(),
      price: parsePrice(history.raw_price),
      discount: history.raw_discount ? parseInt(history.raw_discount) : null,
      raw_price: history.raw_price,
      timestamp: new Date(history.timestamp).getTime()
    }))
    .filter(data => data.price > 0)
    .sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gray-50">
      <TopBar />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopPanel />
          
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="w-full mx-auto px-2">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-1 bg-black hover:bg-gray-900 text-white border border-gray-300 px-2 py-1 rounded text-xs"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Button>
                
                <div className="relative flex-1">
                  <SearchBar
                    initialSearchTerm={searchTerm}
                    onSearch={async (term) => {
                      setSearchTerm(term);
                      setSearchLoading(true);
                      setSearchError(null);
                      try {
                        const response = await axios.get(`${API_BASE_URL}/api/search?q=${encodeURIComponent(term)}`);
                        setSearchResults(response.data);
                      } catch (err) {
                        setSearchError("Failed to fetch search results");
                        setSearchResults([]);
                      } finally {
                        setSearchLoading(false);
                      }
                    }}
                    onSuggestionClick={async (term) => {
                      setSearchTerm(term);
                      setSearchLoading(true);
                      setSearchError(null);
                      try {
                        const response = await axios.get(`${API_BASE_URL}/api/search?q=${encodeURIComponent(term)}`);
                        setSearchResults(response.data);
                      } catch (err) {
                        setSearchError("Failed to fetch search results");
                        setSearchResults([]);
                      } finally {
                        setSearchLoading(false);
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Search Results Section */}
              {searchLoading && (
                <div className="mt-2 text-xs text-blue-600">Searching...</div>
              )}
              {searchError && (
                <div className="mt-2 text-xs text-red-600">{searchError}</div>
              )}
              {searchResults && searchResults.length > 0 && (
                <div className="mt-2 bg-white rounded shadow p-2">
                  <div className="text-xs font-semibold mb-1">Search Results:</div>
                  <ul className="text-xs space-y-1">
                    {searchResults.map((result, idx) => (
                      <li key={idx} className="truncate">
                        {typeof result === 'string' ? result : (result.title || JSON.stringify(result))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Product Image and Basic Info */}
                <div className="md:col-span-1">
                  <div className="bg-white rounded-lg shadow p-2 h-full">
                    <div className="aspect-square relative max-w-full mx-auto">
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="mt-1 text-center">
                      {/* Significantly smaller title */}
                      <h1 className="text-xs font-normal line-clamp-2">{product.title}</h1>
                      <Badge className="mt-1 capitalize text-xs">{product.category}</Badge>
                    </div>
                  </div>
                </div>

                {/* Price Statistics Cards */}
                <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <Card className="bg-white shadow hover:shadow-md transition-shadow">
                    <CardHeader className="pb-0 px-3 py-2">
                      <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Current Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 px-3 pb-2">
                      <div className="text-lg font-bold">₹{currentPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow hover:shadow-md transition-shadow">
                    <CardHeader className="pb-0 px-3 py-2">
                      <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-red-500" />
                        Highest Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 px-3 pb-2">
                      <div className="text-lg font-bold text-red-600">₹{maxPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow hover:shadow-md transition-shadow">
                    <CardHeader className="pb-0 px-3 py-2">
                      <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-green-500" />
                        Lowest Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 px-3 pb-2">
                      <div className="text-lg font-bold text-green-600">₹{minPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow hover:shadow-md transition-shadow">
                    <CardHeader className="pb-0 px-3 py-2">
                      <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Average Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1 px-3 pb-2">
                      <div className="text-lg font-bold">₹{avgPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Price History Chart */}
              <Card className="mt-4 bg-white shadow">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">Price History</CardTitle>
                </CardHeader>
                <CardContent className="px-2 py-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          tickMargin={5}
                        />
                        <YAxis 
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => `₹${value}`}
                          tick={{ fontSize: 10 }}
                          width={40}
                        />
                        <Tooltip 
                          formatter={(value, name, props) => [
                            `₹${value.toLocaleString()}`,
                            'Price'
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.25rem',
                            boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '11px',
                            padding: '4px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#2563eb"
                          strokeWidth={1.5}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Price history log */}
                  <div className="mt-2">
                    <h3 className="text-xs font-semibold mb-1">Price History:</h3>
                    <div className="text-xs bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-1">
                        {chartData.map((entry, idx) => (
                          <div key={idx} className="truncate">
                            {entry.date}: <span className="font-mono">{entry.raw_price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New Prediction Section */}
              <Card className="mt-4 bg-white shadow">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">Price Drop Prediction</CardTitle>
                </CardHeader>
                <CardContent className="px-2 py-2">
                  <p className="text-xs">
                    {prediction}
                  </p>
                </CardContent>
              </Card>
              {/* End Prediction Section */}
              
            </div>
          </div>
        </div>
      </div>
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

export default ProductDetails;