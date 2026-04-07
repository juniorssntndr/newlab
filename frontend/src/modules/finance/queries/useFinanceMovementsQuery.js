import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/AuthContext.jsx';
import { fetchFinanceMovements } from '../api/financeApi.js';
import { financeKeys } from './financeKeys.js';

export const useFinanceMovementsQuery = ({ filters }) => {
    const { getHeaders } = useAuth();

    return useQuery({
        queryKey: financeKeys.movementList(filters),
        queryFn: () => fetchFinanceMovements({ filters, headers: getHeaders() }),
        placeholderData: (previousData) => previousData
    });
};
