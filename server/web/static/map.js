class map {
    constructor(length, breadth) {
        this.length = length;
        this.breadth = breadth;
        this.matrix = [];
        const default_array = []
        for (let i = 0; i < breadth; i++) {
            var arr = []
            for (let j = 0; j < length; j++) {
                arr.push(1);
            }
            this.matrix.push(arr);
        }
    }
    print_map() {
        for (let i = 0; i < this.breadth; i++) {
            console.log(this.matrix[i]);
        }
    }
    clone() {
        var newMap = new map(this.length, this.breadth);
        newMap.matrix = JSON.parse(JSON.stringify(this.matrix));
        return newMap;
    }
    is_valid(x, y) {
        if (x >= 0 && x <= this.length && y >= 0 && y <= this.breadth)
            return true;
        return false;
    }
    is_wall(x, y) {
        return this.is_valid(x, y) && (this.matrix[y][x] == 'B');
    }
    is_normal(x, y) {
        return this.is_valid(x, y) && (this.matrix[y][x] == 1);
    }
};
// var x = new map(5, 5);
// x.matrix[0][4] = 'B';
// x.print_map();



