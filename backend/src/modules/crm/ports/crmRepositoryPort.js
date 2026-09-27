const missing = (name) => async () => {
    throw new Error(`crmRepository.${name} must be implemented`);
};

export const createCrmRepositoryPort = () => ({
    getSummary: missing('getSummary'),
    listEstablishments: missing('listEstablishments'),
    getEstablishment: missing('getEstablishment'),
    createEstablishment: missing('createEstablishment'),
    updateEstablishment: missing('updateEstablishment'),
    assignEstablishment: missing('assignEstablishment'),
    convertEstablishment: missing('convertEstablishment'),
    listComplaints: missing('listComplaints'),
    createComplaint: missing('createComplaint'),
    updateComplaint: missing('updateComplaint'),
    listVisits: missing('listVisits'),
    getVisit: missing('getVisit'),
    createVisit: missing('createVisit'),
    updateVisit: missing('updateVisit'),
    getAlerts: missing('getAlerts'),
    createImportPreview: missing('createImportPreview'),
    getImport: missing('getImport'),
    commitImport: missing('commitImport')
});
