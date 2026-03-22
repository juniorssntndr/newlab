export const billingKeys = {
    all: ['billing'],
    previews: () => [...billingKeys.all, 'preview'],
    preview: (orderId) => [...billingKeys.previews(), orderId]
};
