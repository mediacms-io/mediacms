export const imageExtension = (img: string) => {
    if (img) {
        return img.split('.').pop();
    }
};
