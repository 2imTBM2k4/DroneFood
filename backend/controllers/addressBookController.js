import * as addressBookService from "../services/addressBookService.js";

const handle = (action, successStatus = 200) => async (req, res) => {
  try {
    const result = await action(req);
    res.status(successStatus).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const listAddressBook = handle((req) => addressBookService.listAddressBook(req.user._id));
export const createAddressEntry = handle((req) => addressBookService.createAddressEntry(req.user._id, req.body), 201);
export const updateAddressEntry = handle((req) => addressBookService.updateAddressEntry(req.user._id, req.params.id, req.body));
export const setDefaultAddressEntry = handle((req) => addressBookService.setDefaultAddressEntry(req.user._id, req.params.id));
export const deleteAddressEntry = handle((req) => addressBookService.deleteAddressEntry(req.user._id, req.params.id));
