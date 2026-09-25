import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./EditRestaurant.css";

const EditRestaurant = ({ url, restaurant, onClose, onUpdate }) => {
  const [data, setData] = useState({
    name: "",
    address: "",
    phone: "",
    description: "",
  });

  useEffect(() => {
    if (restaurant) {
      setData({
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone || "",
        description: restaurant.description || "",
      });
    }
  }, [restaurant]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }
    const updateData = {
      id: restaurant._id,
      name: data.name,
      address: data.address,
      phone: data.phone,
      description: data.description,
    };

    try {
      const response = await axios.post(
        `${url}/api/restaurant/update`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        onUpdate();
        onClose();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Error updating restaurant");
    }
  };

  return (
    <div className="edit-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Restaurant</h2>
          <span className="close" onClick={onClose}>
            &times;
          </span>
        </div>
        <form className="flex-col" onSubmit={onSubmitHandler}>
          <div className="add-product-name flex-col">
            <p>Restaurant Name</p>
            <input
              onChange={onChangeHandler}
              value={data.name}
              type="text"
              name="name"
              placeholder="Type here"
              required
            />
          </div>
          <div className="add-product-name flex-col">
            <p>Address</p>
            <input
              onChange={onChangeHandler}
              value={data.address}
              type="text"
              name="address"
              placeholder="Type here"
              required
            />
          </div>
          <div className="add-product-name flex-col">
            <p>Phone</p>
            <input
              onChange={onChangeHandler}
              value={data.phone}
              type="text"
              name="phone"
              placeholder="Type here"
            />
          </div>
          <div className="add-product-description flex-col">
            <p>Description</p>
            <textarea
              onChange={onChangeHandler}
              value={data.description}
              name="description"
              rows="6"
              placeholder="Write content here"
            />
          </div>
          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>
              CANCEL
            </button>
            <button type="submit" className="update-btn">
              UPDATE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRestaurant;
