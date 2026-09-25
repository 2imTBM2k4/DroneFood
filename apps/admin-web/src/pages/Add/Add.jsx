import React, { useState } from 'react'
import './Add.css'
import axios from "axios"
import { toast } from 'react-toastify'

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
                toast.success(response.data.message)
            } else {
                toast.error(response.data.message)
            }
        } catch (error) {
            toast.error("Network error")
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