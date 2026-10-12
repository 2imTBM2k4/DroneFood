import React, { useState } from 'react'
import './Add.css'
import axios from "axios"
import { notificationService } from "@drone-food/web-ui/utils/toast"

const Add = ({url}) => {  
    const [data,setData] = useState({
        name:"",
        address:"",
        phone:"",
        description:"",
        ownerEmail:""
    })

    const onChangeHandler = (event) => {
        const name = event.target.name;
        const value = event.target.value;
        setData(data=>({...data,[name]:value}))
    }

    const onSubmitHandler = async (event) =>{
        event.preventDefault();
        
        try {
            const response = await axios.post(`${url}/api/restaurant/create`, data);
            if (response.data.success) {
                setData({
                    name:"",
                    address:"",
                    phone:"",
                    description:"",
                    ownerEmail:""
                })
                notificationService.success(response.data.message || "Tạo nhà hàng thành công!", undefined, { audience: "admin" })
            } else {
                notificationService.error(
                    "Không thể thêm nhà hàng",
                    response.data.message || "Vui lòng kiểm tra lại thông tin nhà hàng và thử lại.",
                    {
                        audience: "admin",
                        priority: "high",
                        key: `restaurant-create-${data.name}`,
                        actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
                    }
                )
            }
        } catch (error) {
            notificationService.error(
                "Không thể thêm nhà hàng",
                error.response?.data?.message || "Lỗi kết nối máy chủ khi tạo nhà hàng.",
                {
                    audience: "admin",
                    priority: "high",
                    persistent: true,
                    duration: 0,
                    key: `restaurant-create-${data.name}`,
                    actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
                }
            )
        }
    }

  return (
    <div className='add'>
        <form className='flex-col' onSubmit={onSubmitHandler}>
            <div className="add-product-name flex-col">
                <p>Restaurant Name</p>
                <input onChange={onChangeHandler} value={data.name} type="text" name='name' placeholder='Type here' required />
            </div>
            <div className="add-product-name flex-col">
                <p>Address</p>
                <input onChange={onChangeHandler} value={data.address} type="text" name='address' placeholder='Type here' required />
            </div>
            <div className="add-product-name flex-col">
                <p>Phone</p>
                <input onChange={onChangeHandler} value={data.phone} type="text" name='phone' placeholder='Type here' />
            </div>
            <div className="add-product-description flex-col">
                <p>Description</p>
                <textarea onChange={onChangeHandler} value={data.description} name="description" rows="6" placeholder='Write content here' />
            </div>
            <div className="add-product-name flex-col">
                <p>Owner Email (must be registered as restaurant_owner)</p>
                <input onChange={onChangeHandler} value={data.ownerEmail} type="email" name='ownerEmail' placeholder='owner@example.com' required />
            </div>
            <button type='submit' className='add-btn'>ADD</button>
        </form>
    </div>
  )
}

export default Add