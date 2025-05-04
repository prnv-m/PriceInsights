import { useEffect, useState } from 'react';
import axios from 'axios';
import TopPanel from './components/TopPanel';
import { Input } from "./components/ui/input"

function App() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/products").then(res => {
      setData(res.data);
    });
  }, []);

  const filteredData = data.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <TopPanel />
      <Input
        type="text"
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {filteredData.map((item, index) => (
        <div key={index} style={{ margin: "20px", border: "1px solid #ddd", padding: "10px", borderRadius: "5px" }}>
          <h2>{item.title}</h2>
          <p>₹{item.price}</p>
          <img src={item["image-url"]} alt={item.title} width={100} />
        </div>
      ))}
    </div>
  );
}

export default App;