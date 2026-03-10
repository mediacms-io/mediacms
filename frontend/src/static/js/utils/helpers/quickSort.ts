function swap(arr: unknown[], i: number, j: number) {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
}

function partition(arr: number[], pivot: number, left: number, right: number) {
    const pivotValue = arr[pivot];
    let partitionIndex = left;
    for (let i = left; i < right; i++) {
        if (arr[i] < pivotValue) {
            swap(arr, i, partitionIndex);
            partitionIndex++;
        }
    }
    swap(arr, right, partitionIndex);
    return partitionIndex;
}

export function quickSort(arr: number[], left: number, right: number) {
    if (left < right) {
        const pivot = right;
        const partitionIndex = partition(arr, pivot, left, right);
        //sort left and right
        quickSort(arr, left, partitionIndex - 1);
        quickSort(arr, partitionIndex + 1, right);
    }
    return arr;
}
