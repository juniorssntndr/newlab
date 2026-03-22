export const ordersKeys = {
    all: ['orders'],
    lists: () => [...ordersKeys.all, 'list'],
    list: (filters) => [...ordersKeys.lists(), filters],
    details: () => [...ordersKeys.all, 'detail'],
    detail: (orderId) => [...ordersKeys.details(), orderId]
};
