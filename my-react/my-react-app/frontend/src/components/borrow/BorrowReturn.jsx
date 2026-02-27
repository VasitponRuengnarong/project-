import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Save,
  FileText,
  User,
  Briefcase,
  Repeat,
  CheckCircle,
  Search,
  Tag,
  Package,
  Sliders,
  X,
  Filter,
} from "lucide-react";
import "./BorrowReturn.css";
import Swal from "sweetalert2";
import { apiFetch } from "../../services/api";

const BorrowReturn = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("borrow"); // 'borrow' or 'return'
  const [activeBorrows, setActiveBorrows] = useState([]); // List of items to return
  const [masterData, setMasterData] = useState({
    institutions: [],
    departments: [],
    brands: [],
    types: [],
  });
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    borrowDate: new Date().toISOString().split("T")[0],
    returnDate: "",
    purpose: "",
    items: [],
  });

  const [filters, setFilters] = useState({
    brand: "ทั้งหมด",
    type: "ทั้งหมด",
  });

  const [newItem, setNewItem] = useState({ name: "", quantity: 1, remark: "" });
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const fetchMasterData = async () => {
      try {
        const [instRes, deptRes, prodRes, brandRes, typeRes] = await Promise.all([
          apiFetch("/api/institutions"),
          apiFetch("/api/departments"),
          apiFetch("/api/products"),
          apiFetch("/api/brands"),
          apiFetch("/api/types"),
        ]);
        
        if (instRes.ok && deptRes.ok) {
          const institutions = await instRes.json();
          const departments = await deptRes.json();
          const brands = brandRes.ok ? await brandRes.json() : [];
          const types = typeRes.ok ? await typeRes.json() : [];
          
          setMasterData({ 
            institutions, 
            departments, 
            brands, 
            types 
          });
        }
        if (prodRes.ok) {
          const prods = await prodRes.json();
          setProducts(prods);
        }
      } catch (error) {
        console.error("Error fetching master data", error);
      }
    };
    fetchMasterData();
  }, []);

  const fetchActiveBorrows = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/borrows/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        // Filter only Approved or PendingReturn items
        const active = data.filter((item) => item.Status === "Approved" || item.Status === "PendingReturn");
        setActiveBorrows(active);
      }
    } catch (error) {
      console.error("Error fetching active borrows:", error);
    }
  }, [user]);

  // Fetch active borrows when switching to 'return' tab
  useEffect(() => {
    if (activeTab === "return" && user?.id) {
      fetchActiveBorrows();
    }
  }, [activeTab, user, fetchActiveBorrows]);

  const getDepartmentName = (id) => {
    const dept = masterData.departments.find((d) => d.DepartmentID === id);
    return dept ? dept.DepartmentName : "-";
  };

  const getInstitutionName = (id) => {
    const inst = masterData.institutions.find((i) => i.InstitutionID === id);
    return inst ? inst.InstitutionName : "-";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const updateSuggestions = (nameValue, currentFilters) => {
    const filtersToUse = currentFilters || filters;
    const lowerVal = (nameValue || "").toLowerCase().trim();
    
    const filtered = products.filter((p) => {
      const matchesSearch = !lowerVal || 
        (p.DeviceName && p.DeviceName.toLowerCase().includes(lowerVal)) ||
        (p.DeviceCode && p.DeviceCode.toLowerCase().includes(lowerVal));
      
      const matchesBrand = filtersToUse.brand === "ทั้งหมด" || p.BrandName === filtersToUse.brand;
      const matchesType = filtersToUse.type === "ทั้งหมด" || p.TypeName === filtersToUse.type;
      
      return matchesSearch && matchesBrand && matchesType;
    });

    setSuggestions(filtered.slice(0, 10)); // Limit suggestions
    // Show suggestions if there's a search term OR if any filter is active
    setShowSuggestions(lowerVal.length > 0 || filtersToUse.brand !== "ทั้งหมด" || filtersToUse.type !== "ทั้งหมด");
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const updatedFilters = { ...filters, [name]: value };
    setFilters(updatedFilters);
    // Refresh suggestions with the new filters
    updateSuggestions(newItem.name, updatedFilters);
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setNewItem({ ...newItem, name: value });
    updateSuggestions(value);
  };

  const handleSelectSuggestion = (product) => {
    setNewItem({ ...newItem, name: product.DeviceName });
    setShowSuggestions(false);
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const addItem = () => {
    if (newItem.name.trim() === "") return;

    // Check stock availability
    const targetName = newItem.name.trim().toLowerCase();
    const matchingProducts = products.filter(
      (p) => p.DeviceName && p.DeviceName.toLowerCase() === targetName,
    );

    if (matchingProducts.length > 0) {
      const totalAvailable = matchingProducts.reduce((sum, p) => {
        return p.StatusNameDV === "ว่าง" ? sum + (p.Quantity || 0) : sum;
      }, 0);

      const inCartQty = formData.items.reduce((sum, item) => {
        return item.name.toLowerCase() === targetName
          ? sum + parseInt(item.quantity || 0)
          : sum;
      }, 0);

      const requestQty = parseInt(newItem.quantity || 0);

      if (inCartQty + requestQty > totalAvailable) {
        Swal.fire("แจ้งเตือน", `จำนวนอุปกรณ์ไม่เพียงพอ (คงเหลือ: ${totalAvailable})`, "warning");
        return;
      }
    } else {
      Swal.fire("แจ้งเตือน", "ไม่พบข้อมูลอุปกรณ์นี้ในระบบ กรุณาเลือกจากรายการแนะนำ", "warning");
      return;
    }

    setFormData({
      ...formData,
      items: [...formData.items, { ...newItem, id: Date.now() }],
    });
    setNewItem({ name: "", quantity: 1, remark: "" });
  };

  const removeItem = (id) => {
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== id),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      Swal.fire("แจ้งเตือน", "กรุณาเพิ่มรายการอุปกรณ์อย่างน้อย 1 รายการ", "warning");
      return;
    }

    if (!user || !user.id) {
      Swal.fire("แจ้งเตือน", "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่", "error");
      return;
    }

    try {
      const response = await apiFetch("/api/borrow", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          borrowDate: formData.borrowDate,
          returnDate: formData.returnDate,
          purpose: formData.purpose,
          items: formData.items,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire("สำเร็จ", "บันทึกข้อมูลการยืมเรียบร้อยแล้ว", "success");
        // รีเซ็ตฟอร์มหลังจากบันทึกสำเร็จ
        setFormData({ ...formData, purpose: "", items: [] });
      } else {
        Swal.fire("เกิดข้อผิดพลาด", data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
      }
    } catch (error) {
      console.error("Error submitting borrow form:", error);
      Swal.fire("เกิดข้อผิดพลาด", "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์", "error");
    }
  };

  const handleReturn = async (borrowId) => {
    const result = await Swal.fire({
      title: 'ยืนยันการคืน?',
      text: "คุณต้องการแจ้งคืนอุปกรณ์รายการนี้ใช่หรือไม่?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, คืนอุปกรณ์',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/borrows/${borrowId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "PendingReturn" }),
      });

      if (response.ok) {
        Swal.fire("สำเร็จ", "ส่งคำขอคืนอุปกรณ์เรียบร้อยแล้ว รอการตรวจสอบจากเจ้าหน้าที่", "success");
        fetchActiveBorrows(); // Refresh list
      } else {
        const data = await response.json();
        Swal.fire("เกิดข้อผิดพลาด", data.message || "เกิดข้อผิดพลาด", "error");
      }
    } catch (error) {
      console.error("Error returning item:", error);
      Swal.fire("เกิดข้อผิดพลาด", "เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    }
  };

  return (
    <div className="borrow-return-container">

      <div className="page-header">
        <h2>ระบบยืม-คืนอุปกรณ์</h2>
        <p>จัดการคำขอยืมและแจ้งคืนอุปกรณ์</p>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === "borrow" ? "active" : ""}`}
          onClick={() => setActiveTab("borrow")}
        >
          <Plus size={18} /> แจ้งยืมอุปกรณ์
        </button>
        <button
          className={`tab-btn ${activeTab === "return" ? "active" : ""}`}
          onClick={() => setActiveTab("return")}
        >
          <Repeat size={18} /> แจ้งคืนอุปกรณ์
        </button>
      </div>

      <div className="borrow-content">
        {/* User Info Card */}
        <div className="info-card user-info">
          <h3>
            <User size={20} /> ข้อมูลผู้ยืม
          </h3>
          <div className="info-grid">
            <div className="info-item">
              <label>ชื่อ-นามสกุล</label>
              <div className="info-value">
                {user?.firstName} {user?.lastName}
              </div>
            </div>
            <div className="info-item">
              <label>รหัสพนักงาน</label>
              <div className="info-value">{user?.employeeId}</div>
            </div>
            <div className="info-item">
              <label>ตำแหน่ง</label>
              <div className="info-value">{user?.role}</div>
            </div>
            <div className="info-item">
              <label>ฝ่าย/สำนัก</label>
              <div className="info-value">
                {getDepartmentName(user?.departmentId)} /{" "}
                {getInstitutionName(user?.institutionId)}
              </div>
            </div>
          </div>
        </div>

        {activeTab === "borrow" ? (
          <form onSubmit={handleSubmit} className="borrow-form">
            {/* Borrowing Details */}
            <div className="info-card">
              <h3 className="card-title">
                <FileText size={20} /> รายละเอียดการยืม
              </h3>
              <div className="form-row">
                <div className="form-group">
                  <input
                    type="date"
                    name="borrowDate"
                    value={formData.borrowDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="date"
                    name="returnDate"
                    value={formData.returnDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <textarea
                  name="purpose"
                  rows="3"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="ระบุเหตุผลหรือชื่องานที่นำไปใช้..."
                  required
                ></textarea>
              </div>
            </div>

            {/* Items List */}
            <div className="info-card">
              <h3 className="card-title">
                <Briefcase size={20} /> รายการอุปกรณ์
                {formData.items.length > 0 && (
                  <span className="item-count-badge">{formData.items.length} รายการ</span>
                )}
              </h3>

              {/* Discovery Panel: Now as a Pop-up Modal */}
              {showFilterModal && (
                <div className="filter-overlay" onClick={() => setShowFilterModal(false)}>
                  <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-modal-header">
                      <div className="filter-modal-title">
                        <Sliders size={20} />
                        ค้นหาอุปกรณ์แบบละเอียด
                      </div>
                      <button 
                        type="button" 
                        className="modal-close-btn"
                        onClick={() => setShowFilterModal(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="discovery-panel-modal">
                      <div className="filter-section-modal">
                        <div className="filter-group">
                          <div className="filter-header">
                            <Tag className="filter-icon" size={16} />
                            <label className="filter-label">แบรนด์ (Brand)</label>
                          </div>
                          <div className="chips-wrapper">
                            <button
                              type="button"
                              className={`filter-chip ${filters.brand === "ทั้งหมด" ? "active" : ""}`}
                              onClick={() => handleFilterChange({ target: { name: "brand", value: "ทั้งหมด" } })}
                            >
                              ทั้งหมด
                            </button>
                            {masterData.brands.map((b) => (
                              <button
                                key={b.BrandID}
                                type="button"
                                className={`filter-chip ${filters.brand === b.BrandName ? "active" : ""}`}
                                onClick={() => handleFilterChange({ target: { name: "brand", value: b.BrandName } })}
                              >
                                {b.BrandName}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="filter-group">
                          <div className="filter-header">
                            <Package className="filter-icon" size={16} />
                            <label className="filter-label">ประเภทสินค้า (Device Type)</label>
                          </div>
                          <div className="chips-wrapper">
                            <button
                              type="button"
                              className={`filter-chip ${filters.type === "ทั้งหมด" ? "active" : ""}`}
                              onClick={() => handleFilterChange({ target: { name: "type", value: "ทั้งหมด" } })}
                            >
                              ทั้งหมด
                            </button>
                            {masterData.types.map((t) => (
                              <button
                                key={t.TypeID}
                                type="button"
                                className={`filter-chip ${filters.type === t.TypeName ? "active" : ""}`}
                                onClick={() => handleFilterChange({ target: { name: "type", value: t.TypeName } })}
                              >
                                {t.TypeName}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="filter-modal-footer">
                      <button 
                        type="button" 
                        className="modal-apply-btn"
                        onClick={() => setShowFilterModal(false)}
                      >
                        ดูผลลัพธ์
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="selection-bar">
                  <div className="add-item-field">
                    <label className="add-item-label">&nbsp;</label>
                    <button 
                      type="button" 
                      className={`filter-toggle-btn ${(filters.brand !== "ทั้งหมด" || filters.type !== "ทั้งหมด") ? 'active' : ''}`}
                      onClick={() => setShowFilterModal(true)}
                    >
                      <Filter size={18} />
                      <span>ตัวกรอง</span>
                      {(filters.brand !== "ทั้งหมด" || filters.type !== "ทั้งหมด") && (
                        <span className="filter-badge">
                          {(filters.brand !== "ทั้งหมด" ? 1 : 0) + (filters.type !== "ทั้งหมด" ? 1 : 0)}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="add-item-field">
                    <label className="add-item-label"><Search size={14} /> ค้นหาอุปกรณ์</label>
                    <div className="modern-select-wrapper">
                      <div className="modern-input-group">
                        <Search className="input-icon" size={18} />
                        <input
                          type="text"
                          name="name"
                          placeholder="พิมพ์ชื่ออุปกรณ์เพื่อค้นหา..."
                          value={newItem.name}
                          onChange={handleNameChange}
                          className="modern-input"
                          autoComplete="off"
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          onFocus={() => (newItem.name || filters.brand !== "ทั้งหมด" || filters.type !== "ทั้งหมด") && setShowSuggestions(true)}
                        />
                      </div>
                      {showSuggestions && suggestions.length > 0 && (
                        <ul className="suggestions-list">
                          {suggestions.map((p) => (
                            <li
                              key={p.DVID}
                              className="suggestion-item"
                              onClick={() => handleSelectSuggestion(p)}
                            >
                              <div className="suggestion-name">{p.DeviceName}</div>
                              {p.BrandName && p.TypeName && (
                                <div className="suggestion-code">
                                  {p.BrandName} • {p.TypeName}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="add-item-field">
                    <label className="add-item-label"><Package size={14} /> จำนวน</label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      value={newItem.quantity}
                      onChange={handleItemChange}
                      className="item-input-qty"
                    />
                  </div>

                  <div className="add-item-field">
                    <label className="add-item-label"><FileText size={14} /> หมายเหตุ</label>
                    <input
                      type="text"
                      name="remark"
                      placeholder="ระบุหมายเหตุ (ถ้ามี)"
                      value={newItem.remark}
                      onChange={handleItemChange}
                      className="item-input-remark"
                    />
                  </div>

                  <button type="button" onClick={addItem} className="add-btn">
                    <Plus size={20} />
                    <span>เพิ่มเข้าลิสต์</span>
                  </button>
                </div>

              {/* Item Card List: Premium view */}
              {formData.items.length === 0 ? (
                <div className="empty-items-state">
                  <Package size={48} className="empty-icon" />
                  <p className="empty-title">ยังไม่ได้เพิ่มรายการอุปกรณ์</p>
                  <p className="empty-subtitle">เลือกแบรนด์/ประเภท หรือค้นหาอุปกรณ์ด้านบนเพื่อเริ่มต้น</p>
                </div>
              ) : (
                <div className="item-card-list">
                  <div className="item-card-header">
                    <span>#</span>
                    <span>ชื่ออุปกรณ์</span>
                    <span style={{ textAlign: "center" }}>จำนวน</span>
                    <span>หมายเหตุ</span>
                    <span style={{ textAlign: "right" }}>จัดการ</span>
                  </div>
                  {formData.items.map((item, index) => (
                    <div key={item.id} className="item-card-row">
                      <div className="item-no-badge">{index + 1}</div>
                      <div className="item-name">{item.name}</div>
                      <div style={{ textAlign: "center" }}>
                        <span className="item-qty-badge">{item.quantity}</span>
                      </div>
                      <div className="item-remark">
                        {item.remark || <span style={{ opacity: 0.3 }}>— ไม่ระบุ —</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="delete-btn"
                          title="ลบรายการ"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                <Save size={18} /> บันทึกการยืม
              </button>
            </div>
          </form>
        ) : (
          <div className="info-card">
            <h3 className="card-title">
              <Repeat size={20} /> รายการที่ต้องคืน (Approved)
            </h3>
            {activeBorrows.length === 0 ? (
              <div className="empty-row" style={{ padding: "40px" }}>
                <CheckCircle
                  size={48}
                  color="#2ecc71"
                  style={{ marginBottom: "10px" }}
                />
                <p>ไม่มีรายการค้างคืนในขณะนี้</p>
              </div>
            ) : (
              <div className="items-table-wrapper">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>รหัสรายการ</th>
                      <th>วันที่ยืม</th>
                      <th>กำหนดคืน</th>
                      <th>วัตถุประสงค์</th>
                      <th>รายการอุปกรณ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBorrows.map((borrow) => (
                      <tr key={borrow.BorrowID}>
                        <td>#{borrow.BorrowID}</td>
                        <td>
                          {new Date(borrow.BorrowDate).toLocaleDateString(
                            "th-TH",
                          )}
                        </td>
                        <td>
                          {new Date(borrow.ReturnDate).toLocaleDateString(
                            "th-TH",
                          )}
                        </td>
                        <td>{borrow.Purpose}</td>
                        <td>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "20px",
                              fontSize: "0.9rem",
                            }}
                          >
                            {borrow.items.map((item) => (
                              <li key={item.BorrowDetailID}>
                                {item.ItemName} (x{item.Quantity})
                              </li>
                            ))}
                          </ul>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BorrowReturn;
