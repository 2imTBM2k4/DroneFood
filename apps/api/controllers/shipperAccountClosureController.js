import * as service from "../services/shipperAccountClosureService.js";

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req, res)); }
  catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};

export const request = respond(async (req) => {
  const result = await service.requestClosure(req.user._id, req.body);
  return { success: true, data: result.closure };
});
export const updateBankDetails = respond(async (req) => ({
  success: true,
  data: await service.updateBankDetails(req.body.token, req.body),
}));
export const sendBankDetailsForm = respond(async (req) => ({
  success: true,
  data: await service.sendBankDetailsForm(req.params.id),
}));
export const approve = respond(async (req) => ({
  success: true,
  data: await service.approveClosure(req.user, req.params.id),
}));
