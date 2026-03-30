import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

function BusinessScanner() {
  const CLOUD_NAME = "doqmshx5y";
  const UPLOAD_PRESET = "ml_default";
  const LOG_ID = "nhat_ky_du_lieu";
  // ANH DÁN LẠI KEY CHUẨN import React, { useState, useEffect } from 'react'; // Đã sửa Import thành import
import { GoogleGenerativeAI } from "@google/generative-ai";

function BusinessScanner() {
  const CLOUD_NAME = "doqmshx5y";
  const UPLOAD_PRESET = "ml_default";
  const LOG_ID = "nhat_ky_du_lieu";
  // ANH DÁN LẠI KEY CHUẨN CỦA ANH VÀO ĐÂY
  const GEMINI_KEY = "AIzaSy..."; 

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);

  const loadData = async () => {
    try {
      const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LOG_ID}.txt?v=${Date.now()}`);
      if (r.ok) {
        const text = await r.text();
        const data = text.split('\n').filter(l => l.length > 10).map(line => JSON.parse(line));
        setHistory(data.reverse());
      }
    } catch (e) { console.log("Chưa có dữ liệu."); }
  };

  useEffect(() => { loadData(); }, []);

  const fileToAiPart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({
        inlineData: { data: reader.result.split(',')[1], mimeType: file.type }
      });
      reader.readAsDataURL(file);
    });
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setMsg("Gemini đang phân tích...");

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const imagePart = await fileToAiPart(file);
      
      const prompt = "Trích xuất thông tin card/bảng hiệu. Trả về JSON: {\"name\": \"...\", \"phone\": \"...\", \"address\": \"...\"}. Chỉ trả về JSON.";
      
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const aiText = response.text().replace(/```json|```/g, "").trim();
      const aiData = JSON.parse(aiText);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
      const cloud = await resCloud.json();

      setExtractedData({
        name: aiData.name || "Khách hàng mới",
        phone: aiData.phone || "",
        address: aiData.address || "",
        url: cloud.secure_url
      });
      setShowForm(true);
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
    setLoading(false);
  };

  const saveFinal = async () => {
    setLoading(true);
    try {
      const newItem = { 
        n: extractedData.name, p: extractedData.phone, a: extractedData.address, 
        u: extractedData.url, t: new Date().toLocaleString('vi-VN') 
      };
      const updatedLog = [...history].reverse().concat(newItem).map(h => JSON.stringify(h)).join('\n');
      const logFile = new File([updatedLog], `${LOG_ID}.txt`, { type: 'text/plain' });
      const logFd = new FormData();
      logFd.append("file", logFile);
      logFd.append("upload_preset", UPLOAD_PRESET);
      logFd.append("public_id", LOG_ID);
      logFd.append("resource_type", "raw");
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: logFd });
      setShowForm(false);
      loadData();
      alert("Đã lưu!");
    } catch (e) { alert("Lỗi mạng!"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '15px', maxWidth: '500px', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center', color: '#007bff' }}>MÁY QUÉT HỒ SƠ AI</h3>

      {!showForm ? (
        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #007bff' }}>
          {loading ? <b>{msg}</b> : (
            <label style={{ background: '#007bff', color: '#fff', padding: '15px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
               📸 QUÉT CARD / BẢNG HIỆU
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd' }}>
          <h4 style={{ color: '#28a745' }}>AI ĐÃ ĐIỀN XONG:</h4>
          <input style={{ width: '100%', padding: '10px', marginBottom: '10px' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} placeholder="Tên" />
          <input style={{ width: '100%', padding: '10px', marginBottom: '10px' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} placeholder="SĐT" />
          <textarea style={{ width: '100%', padding: '10px', marginBottom: '15px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} placeholder="Địa chỉ" />
          <button onClick={saveFinal} style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px' }}>XÁC NHẬN LƯU</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {history.map((item, i) => (
          <div key={i} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><b>{item.n}</b><br/><small>{item.p}</small></div>
            <button onClick={() => setViewUrl(item.u)} style={{ background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px' }}>XEM</button>
          </div>
        ))}
      </div>

      {viewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 100 }}>
          <button onClick={() => setViewUrl(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'red', color: '#fff', padding: '10px' }}>ĐÓNG</button>
          <img src={viewUrl} style={{ width: '100%', marginTop: '60px' }} alt="origin" />
        </div>
      )}
    </div>
  );
}

export default BusinessScanner;
 ANH VÀO ĐÂY
  const GEMINI_KEY = "AIzaSy..."; 

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [extractedData, setExtractedData] = useState({ name: "", phone: "", address: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);

  const loadData = async () => {
    try {
      const r = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${LOG_ID}.txt?v=${Date.now()}`);
      if (r.ok) {
        const text = await r.text();
        const data = text.split('\n').filter(l => l.length > 10).map(line => JSON.parse(line));
        setHistory(data.reverse());
      }
    } catch (e) { console.log("Chưa có dữ liệu."); }
  };

  useEffect(() => { loadData(); }, []);

  const fileToAiPart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({
        inlineData: { data: reader.result.split(',')[1], mimeType: file.type }
      });
      reader.readAsDataURL(file);
    });
  };

  const handleScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setMsg("Gemini đang phân tích...");

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      // Dùng bản latest để tránh lỗi 404
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const imagePart = await fileToAiPart(file);
      
      const prompt = "Trích xuất thông tin card/bảng hiệu. Trả về JSON: {\"name\": \"...\", \"phone\": \"...\", \"address\": \"...\"}. Chỉ trả về JSON.";
      
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const aiText = response.text().replace(/```json|```/g, "").trim();
      const aiData = JSON.parse(aiText);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const resCloud = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: fd });
      const cloud = await resCloud.json();

      setExtractedData({
        name: aiData.name || "Khách hàng mới",
        phone: aiData.phone || "",
        address: aiData.address || "",
        url: cloud.secure_url
      });
      setShowForm(true);
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
    setLoading(false);
  };

  const saveFinal = async () => {
    setLoading(true);
    try {
      const newItem = { 
        n: extractedData.name, p: extractedData.phone, a: extractedData.address, 
        u: extractedData.url, t: new Date().toLocaleString('vi-VN') 
      };
      const updatedLog = [...history].reverse().concat(newItem).map(h => JSON.stringify(h)).join('\n');
      const logFile = new File([updatedLog], `${LOG_ID}.txt`, { type: 'text/plain' });
      const logFd = new FormData();
      logFd.append("file", logFile);
      logFd.append("upload_preset", UPLOAD_PRESET);
      logFd.append("public_id", LOG_ID);
      logFd.append("resource_type", "raw");
      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: logFd });
      setShowForm(false);
      loadData();
      alert("Đã lưu!");
    } catch (e) { alert("Lỗi mạng!"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '15px', maxWidth: '500px', margin: 'auto' }}>
      <h3 style={{ textAlign: 'center', color: '#007bff' }}>MÁY QUÉT HỒ SƠ AI</h3>

      {!showForm ? (
        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #007bff' }}>
          {loading ? <b>{msg}</b> : (
            <label style={{ background: '#007bff', color: '#fff', padding: '15px 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
               📸 QUÉT CARD / BẢNG HIỆU
               <input type="file" accept="image/*" onChange={handleScan} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd' }}>
          <h4 style={{ color: '#28a745' }}>AI ĐÃ ĐIỀN XONG:</h4>
          <input style={{ width: '100%', padding: '10px', marginBottom: '10px' }} value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} placeholder="Tên" />
          <input style={{ width: '100%', padding: '10px', marginBottom: '10px' }} value={extractedData.phone} onChange={e => setExtractedData({...extractedData, phone: e.target.value})} placeholder="SĐT" />
          <textarea style={{ width: '100%', padding: '10px', marginBottom: '15px' }} value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} placeholder="Địa chỉ" />
          <button onClick={saveFinal} style={{ width: '100%', padding: '12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px' }}>XÁC NHẬN LƯU</button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {history.map((item, i) => (
          <div key={i} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><b>{item.n}</b><br/><small>{item.p}</small></div>
            <button onClick={() => setViewUrl(item.u)} style={{ background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px' }}>XEM</button>
          </div>
        ))}
      </div>

      {viewUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 100 }}>
          <button onClick={() => setViewUrl(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'red', color: '#fff', padding: '10px' }}>ĐÓNG</button>
          <img src={viewUrl} style={{ width: '100%', marginTop: '60px' }} alt="origin" />
        </div>
      )}
    </div>
  );
}

export default BusinessScanner;
