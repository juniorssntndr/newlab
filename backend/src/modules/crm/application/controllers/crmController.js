const send = (res, result) => {
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error, code: result.type });
    return res.status(result.status || 200).json(result.meta ? { data: result.data, meta: result.meta } : result.data);
};

const action = (handler) => async (req, res, next) => {
    try { return send(res, await handler(req)); }
    catch (error) { return next(error); }
};

export const makeCrmController = ({ crmService }) => ({
    getSummary: action((req) => crmService.getSummary({ user: req.user })),
    listEstablishments: action((req) => crmService.listEstablishments({ user: req.user, filters: req.query })),
    getEstablishment: action((req) => crmService.getEstablishment({ user: req.user, id: req.params.id })),
    createEstablishment: action((req) => crmService.createEstablishment({ user: req.user, body: req.body })),
    updateEstablishment: action((req) => crmService.updateEstablishment({ user: req.user, id: req.params.id, body: { ...req.body } })),
    deleteEstablishment: action((req) => crmService.deleteEstablishment({ user: req.user, id: req.params.id })),
    assignEstablishment: action((req) => crmService.assignEstablishment({ user: req.user, id: req.params.id, body: req.body })),
    convertEstablishment: action((req) => crmService.convertEstablishment({ user: req.user, id: req.params.id, body: req.body })),
    listComplaints: action((req) => crmService.listComplaints({ user: req.user, filters: req.query })),
    createComplaint: action((req) => crmService.createComplaint({ user: req.user, body: req.body })),
    updateComplaint: action((req) => crmService.updateComplaint({ user: req.user, id: req.params.id, body: req.body })),
    listVisits: action((req) => crmService.listVisits({ user: req.user, filters: req.query })),
    createVisit: action((req) => crmService.createVisit({ user: req.user, body: req.body })),
    updateVisit: action((req) => crmService.updateVisit({ user: req.user, id: req.params.id, body: req.body })),
    getAlerts: action((req) => crmService.getAlerts({ user: req.user })),
    previewImport: action((req) => {
        let mapping = {};
        if (req.body?.mapping) {
            try { mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping; }
            catch { throw Object.assign(new Error('mapping debe ser JSON válido'), { status: 400 }); }
        }
        return crmService.previewImport({ user: req.user, file: req.file, mapping });
    }),
    getImport: action((req) => crmService.getImport({ user: req.user, id: req.params.id })),
    commitImport: action((req) => crmService.commitImport({ user: req.user, id: req.params.id, body: req.body }))
});
