import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Search } from "lucide-react";
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

function ProductDetails() {
  const { asin } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/products/${asin}`);
        setProduct(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching product details:", err);
        setError("Failed to load product details");
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [asin]);

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
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
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
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <div className="flex">
        <div className="flex-1">
          <TopPanel />
          
          <div className="p-6">
            <div className="w-[1480px] mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <Button
                  variant="ghost"
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2
         bg-black hover:bg-gray-900
         text-white
         border-2 border-gray-300 px-4 py-2 rounded"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Products
                </Button>
                
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 border-2 border-gray-300 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Product Image and Basic Info */}
                <div className="space-y-4">
                  <div className="bg-white rounded-lg shadow-lg p-4">
                    <div className="aspect-square relative max-w-[400px] mx-auto">
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="mt-4">
                      <h1 className="text-2xl font-bold">{product.title}</h1>
                      <Badge className="mt-2 capitalize">{product.category}</Badge>
                    </div>
                  </div>
                </div>

                {/* Price Statistics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Current Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{currentPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-red-500" />
                        Highest Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">₹{maxPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-green-500" />
                        Lowest Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">₹{minPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Average Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{avgPrice.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Price History Chart */}
              <Card className="mt-8 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle>Price History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => `₹${value.toLocaleString()}`}
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
                            borderRadius: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Display all price instances below the chart */}
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">All Price Instances:</h3>
                    <ul className="text-sm bg-gray-100 rounded p-2 max-h-40 overflow-y-auto">
                      {chartData.map((entry, idx) => (
                        <li key={idx} className="mb-1">
                          {entry.date}: <span className="font-mono">{entry.raw_price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;