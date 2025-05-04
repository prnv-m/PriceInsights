import React from 'react';

function SearchBar({ searchTerm, setSearchTerm }) {
  return (
    <div style={{ margin: "20px", textAlign: "center" }}>
      <input
        type="text"
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: "10px",
          width: "80%",
          maxWidth: "400px",
          border: "1px solid #ccc",
          borderRadius: "5px"
        }}
      />
    </div>
  );
}

export default SearchBar;