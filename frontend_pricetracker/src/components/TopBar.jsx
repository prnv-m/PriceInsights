import { Button } from "./ui/button";
import { UserCircle } from "lucide-react";

export default function TopBar() {
  return (
    <div className="w-full h-16 border-b bg-white">
      <div className="h-full max-w-9xl mx-auto px-4 flex items-center justify-between">
        {/* Left side - Logo and nav items */}
        <div className="flex items-center space-x-8">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img 
              src="/assets/shopmetrics1.png" 
              alt="ShopMetrics" 
              className="h-18 w-18"
            />
            <span className="text-xl font-semibold">ShopMetrics</span>
          </div>

          {/* Navigation items */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#trending" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Trending
            </a>
            <a href="#bestsellers" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Bestsellers
            </a>
            <a href="#deals" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Today's Deals
            </a>
            <a href="#about" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              About Us
            </a>
          </nav>
        </div>

        {/* Right side - Auth buttons */}
        <div className="flex items-center space-x-4">
          <Button variant ="primary" className="text-sm font-medium bg-black text-white hover:bg-gray-800">
            Log in
          </Button>
          <Button className="text-sm font-medium bg-black text-white hover:bg-gray-800">
            Sign up
          </Button>
        </div>
      </div>
    </div>
  );
}