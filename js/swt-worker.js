/*! naptha 22-04-2014 */
IMPORTED = true
/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

// namespace ?
var jsfeat = jsfeat || { REVISION: 'ALPHA' };



/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    // CONSTANTS
    var EPSILON = 0.0000001192092896;
    var FLT_MIN = 1E-37;

    // implementation from CCV project
    // currently working only with u8,s32,f32
    var U8_t = 0x0100,
        S32_t = 0x0200,
        F32_t = 0x0400,
        S64_t = 0x0800,
        F64_t = 0x1000;

    var C1_t = 0x01,
        C2_t = 0x02,
        C3_t = 0x03,
        C4_t = 0x04;

    var _data_type_size = new Int32Array([ -1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8 ]);

    var get_data_type = (function () {
        return function(type) {
            return (type & 0xFF00);
        }
    })();

    var get_channel = (function () {
        return function(type) {
            return (type & 0xFF);
        }
    })();

    var get_data_type_size = (function () {
        return function(type) {
            return _data_type_size[(type & 0xFF00) >> 8];
        }
    })();

    // box blur option
    var BOX_BLUR_NOSCALE = 0x01;
    // svd options
    var SVD_U_T = 0x01;
    var SVD_V_T = 0x02;

    var data_t = (function () {
        function data_t(size_in_bytes, buffer) {
            // we need align size to multiple of 8
            this.size = ((size_in_bytes + 7) | 0) & -8;
            if (typeof buffer === "undefined") { 
                this.buffer = new ArrayBuffer(this.size);
            } else {
                this.buffer = buffer;
                this.size = buffer.length;
            }
            this.u8 = new Uint8Array(this.buffer);
            this.i32 = new Int32Array(this.buffer);
            this.f32 = new Float32Array(this.buffer);
            this.f64 = new Float64Array(this.buffer);
        }
        return data_t;
    })();

    var matrix_t = (function () {
        // columns, rows, data_type
        function matrix_t(c, r, data_type, data_buffer) {
            this.type = get_data_type(data_type)|0;
            this.channel = get_channel(data_type)|0;
            this.cols = c|0;
            this.rows = r|0;
            if (typeof data_buffer === "undefined") { 
                this.allocate();
            } else {
                this.buffer = data_buffer;
                // data user asked for
                this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
            }
        }
        matrix_t.prototype.allocate = function() {
            // clear references
            delete this.data;
            delete this.buffer;
            //
            this.buffer = new data_t((this.cols * get_data_type_size(this.type) * this.channel) * this.rows);
            this.data = this.type&U8_t ? this.buffer.u8 : (this.type&S32_t ? this.buffer.i32 : (this.type&F32_t ? this.buffer.f32 : this.buffer.f64));
        }
        matrix_t.prototype.copy_to = function(other) {
            var od = other.data, td = this.data;
            var i = 0, n = (this.cols*this.rows*this.channel)|0;
            for(; i < n-4; i+=4) {
                od[i] = td[i];
                od[i+1] = td[i+1];
                od[i+2] = td[i+2];
                od[i+3] = td[i+3];
            }
            for(; i < n; ++i) {
                od[i] = td[i];
            }
        }
        matrix_t.prototype.resize = function(c, r, ch) {
            if (typeof ch === "undefined") { ch = this.channel; }
            // change buffer only if new size doesnt fit
            var new_size = (c * ch) * r;
            if(new_size > this.rows*this.cols*this.channel) {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
                this.allocate();
            } else {
                this.cols = c;
                this.rows = r;
                this.channel = ch;
            }
        }

        return matrix_t;
    })();

    var pyramid_t = (function () {

        function pyramid_t(levels) {
            this.levels = levels|0;
            this.data = new Array(levels);
            this.pyrdown = jsfeat.imgproc.pyrdown;
        }

        pyramid_t.prototype.allocate = function(start_w, start_h, data_type) {
            var i = this.levels;
            while(--i >= 0) {
                this.data[i] = new matrix_t(start_w >> i, start_h >> i, data_type);
            }
        }

        pyramid_t.prototype.build = function(input, skip_first_level) {
            if (typeof skip_first_level === "undefined") { skip_first_level = true; }
            // just copy data to first level
            var i = 2, a = input, b = this.data[0];
            if(!skip_first_level) {
                var j=input.cols*input.rows;
                while(--j >= 0) {
                    b.data[j] = input.data[j];
                }
            }
            b = this.data[1];
            this.pyrdown(a, b);
            for(; i < this.levels; ++i) {
                a = b;
                b = this.data[i];
                this.pyrdown(a, b);
            }
        }

        return pyramid_t;
    })();

    var point2d_t = (function () {
        function point2d_t(x,y,score,level) {
            if (typeof x === "undefined") { x=0; }
            if (typeof y === "undefined") { y=0; }
            if (typeof score === "undefined") { score=0; }
            if (typeof level === "undefined") { level=0; }

            this.x = x;
            this.y = y;
            this.score = score;
            this.level = level;
        }
        return point2d_t;
    })();


    // data types
    global.U8_t = U8_t;
    global.S32_t = S32_t;
    global.F32_t = F32_t;
    global.S64_t = S64_t;
    global.F64_t = F64_t;
    // data channels
    global.C1_t = C1_t;
    global.C2_t = C2_t;
    global.C3_t = C3_t;
    global.C4_t = C4_t;

    // popular formats
    global.U8C1_t = U8_t | C1_t;
    global.U8C3_t = U8_t | C3_t;
    global.U8C4_t = U8_t | C4_t;

    global.F32C1_t = F32_t | C1_t;
    global.F32C2_t = F32_t | C2_t;
    global.S32C1_t = S32_t | C1_t;
    global.S32C2_t = S32_t | C2_t;

    // constants
    global.EPSILON = EPSILON;
    global.FLT_MIN = FLT_MIN;

    // options
    global.BOX_BLUR_NOSCALE = BOX_BLUR_NOSCALE;
    global.SVD_U_T = SVD_U_T;
    global.SVD_V_T = SVD_V_T;

    global.get_data_type = get_data_type;
    global.get_channel = get_channel;
    global.get_data_type_size = get_data_type_size;

    global.data_t = data_t;
    global.matrix_t = matrix_t;
    global.pyramid_t = pyramid_t;
    global.point2d_t = point2d_t;

})(jsfeat);



/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var cache = (function() {

        // very primitive array cache, still need testing if it helps
        // of course V8 has its own powerful cache sys but i'm not sure
        // it caches several multichannel 640x480 buffer creations each frame

        var _pool_node_t = (function () {
            function _pool_node_t(size_in_bytes) {
                this.next = null;
                this.data = new jsfeat.data_t(size_in_bytes);
                this.size = this.data.size;
                this.buffer = this.data.buffer;
                this.u8 = this.data.u8;
                this.i32 = this.data.i32;
                this.f32 = this.data.f32;
                this.f64 = this.data.f64;
            }
            _pool_node_t.prototype.resize = function(size_in_bytes) {
                delete this.data;
                this.data = new jsfeat.data_t(size_in_bytes);
                this.size = this.data.size;
                this.buffer = this.data.buffer;
                this.u8 = this.data.u8;
                this.i32 = this.data.i32;
                this.f32 = this.data.f32;
                this.f64 = this.data.f64;
            }
            return _pool_node_t;
        })();

        var _pool_head, _pool_tail;
        var _pool_size = 0;

        return {

            allocate: function(capacity, data_size) {
                _pool_head = _pool_tail = new _pool_node_t(data_size);
                for (var i = 0; i < capacity; ++i) {
                    var node = new _pool_node_t(data_size);
                    _pool_tail = _pool_tail.next = node;

                    _pool_size++;
                }
            },

            get_buffer: function(size_in_bytes) {
                // assume we have enough free nodes
                var node = _pool_head;
                _pool_head = _pool_head.next;
                _pool_size--;

                if(size_in_bytes > node.size) {
                    node.resize(size_in_bytes);
                }

                return node;
            },

            put_buffer: function(node) {
                _pool_tail = _pool_tail.next = node;
                _pool_size++;
            }
        };
    })();

    global.cache = cache;
    // for now we dont need more than 30 buffers
    // if having cache sys really helps we can add auto extending sys
    cache.allocate(30, 640*4);

})(jsfeat);


/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var math = (function() {

        var qsort_stack = new Int32Array(48*2);

        return {
            get_gaussian_kernel: function(size, sigma, kernel, data_type) {
                var i=0,x=0.0,t=0.0,sigma_x=0.0,scale_2x=0.0;
                var sum = 0.0;
                var kern_node = jsfeat.cache.get_buffer(size<<2);
                var _kernel = kern_node.f32;//new Float32Array(size);

                if((size&1) == 1 && size <= 7 && sigma <= 0) {
                    switch(size>>1) {
                        case 0:
                        _kernel[0] = 1.0;
                        sum = 1.0;
                        break;
                        case 1:
                        _kernel[0] = 0.25, _kernel[1] = 0.5, _kernel[2] = 0.25;
                        sum = 0.25+0.5+0.25;
                        break;
                        case 2:
                        _kernel[0] = 0.0625, _kernel[1] = 0.25, _kernel[2] = 0.375, 
                        _kernel[3] = 0.25, _kernel[4] = 0.0625;
                        sum = 0.0625+0.25+0.375+0.25+0.0625;
                        break;
                        case 3:
                        _kernel[0] = 0.03125, _kernel[1] = 0.109375, _kernel[2] = 0.21875, 
                        _kernel[3] = 0.28125, _kernel[4] = 0.21875, _kernel[5] = 0.109375, _kernel[6] = 0.03125;
                        sum = 0.03125+0.109375+0.21875+0.28125+0.21875+0.109375+0.03125;
                        break;
                    }
                } else {
                    sigma_x = sigma > 0 ? sigma : ((size-1)*0.5 - 1.0)*0.3 + 0.8;
                    scale_2x = -0.5/(sigma_x*sigma_x);

                    for( ; i < size; ++i )
                    {
                        x = i - (size-1)*0.5;
                        t = Math.exp(scale_2x*x*x);

                        _kernel[i] = t;
                        sum += t;
                    }
                }

                if(data_type & jsfeat.U8_t) {
                    // int based kernel
                    sum = 256.0/sum;
                    for (i = 0; i < size; ++i) {
                        kernel[i] = (_kernel[i] * sum + 0.5)|0;
                    }
                } else {
                    // classic kernel
                    sum = 1.0/sum;
                    for (i = 0; i < size; ++i) {
                        kernel[i] = _kernel[i] * sum;
                    }
                }

                jsfeat.cache.put_buffer(kern_node);
            },

            // model is 3x3 matrix_t
            perspective_4point_transform: function(model, src_x0, src_y0, dst_x0, dst_y0,
                                                        src_x1, src_y1, dst_x1, dst_y1,
                                                        src_x2, src_y2, dst_x2, dst_y2,
                                                        src_x3, src_y3, dst_x3, dst_y3) {
                var t1 = src_x0;
                var t2 = src_x2;
                var t4 = src_y1;
                var t5 = t1 * t2 * t4;
                var t6 = src_y3;
                var t7 = t1 * t6;
                var t8 = t2 * t7;
                var t9 = src_y2;
                var t10 = t1 * t9;
                var t11 = src_x1;
                var t14 = src_y0;
                var t15 = src_x3;
                var t16 = t14 * t15;
                var t18 = t16 * t11;
                var t20 = t15 * t11 * t9;
                var t21 = t15 * t4;
                var t24 = t15 * t9;
                var t25 = t2 * t4;
                var t26 = t6 * t2;
                var t27 = t6 * t11;
                var t28 = t9 * t11;
                var t30 = 1.0 / (t21-t24 - t25 + t26 - t27 + t28);
                var t32 = t1 * t15;
                var t35 = t14 * t11;
                var t41 = t4 * t1;
                var t42 = t6 * t41;
                var t43 = t14 * t2;
                var t46 = t16 * t9;
                var t48 = t14 * t9 * t11;
                var t51 = t4 * t6 * t2;
                var t55 = t6 * t14;
                var Hr0 = -(t8-t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
                var Hr1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
                var Hr2 = t1;
                var Hr3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
                var Hr4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
                var Hr5 = t14;
                var Hr6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
                var Hr7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;
                
                t1 = dst_x0;
                t2 = dst_x2;
                t4 = dst_y1;
                t5 = t1 * t2 * t4;
                t6 = dst_y3;
                t7 = t1 * t6;
                t8 = t2 * t7;
                t9 = dst_y2;
                t10 = t1 * t9;
                t11 = dst_x1;
                t14 = dst_y0;
                t15 = dst_x3;
                t16 = t14 * t15;
                t18 = t16 * t11;
                t20 = t15 * t11 * t9;
                t21 = t15 * t4;
                t24 = t15 * t9;
                t25 = t2 * t4;
                t26 = t6 * t2;
                t27 = t6 * t11;
                t28 = t9 * t11;
                t30 = 1.0 / (t21-t24 - t25 + t26 - t27 + t28);
                t32 = t1 * t15;
                t35 = t14 * t11;
                t41 = t4 * t1;
                t42 = t6 * t41;
                t43 = t14 * t2;
                t46 = t16 * t9;
                t48 = t14 * t9 * t11;
                t51 = t4 * t6 * t2;
                t55 = t6 * t14;
                var Hl0 = -(t8-t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
                var Hl1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
                var Hl2 = t1;
                var Hl3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
                var Hl4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
                var Hl5 = t14;
                var Hl6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
                var Hl7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

                // the following code computes R = Hl * inverse Hr
                t2 = Hr4-Hr7*Hr5;
                t4 = Hr0*Hr4;
                t5 = Hr0*Hr5;
                t7 = Hr3*Hr1;
                t8 = Hr2*Hr3;
                t10 = Hr1*Hr6;
                var t12 = Hr2*Hr6;
                t15 = 1.0 / (t4-t5*Hr7-t7+t8*Hr7+t10*Hr5-t12*Hr4);
                t18 = -Hr3+Hr5*Hr6;
                var t23 = -Hr3*Hr7+Hr4*Hr6;
                t28 = -Hr1+Hr2*Hr7;
                var t31 = Hr0-t12;
                t35 = Hr0*Hr7-t10;
                t41 = -Hr1*Hr5+Hr2*Hr4;
                var t44 = t5-t8;
                var t47 = t4-t7;
                t48 = t2*t15;
                var t49 = t28*t15;
                var t50 = t41*t15;
                var mat = model.data;
                mat[0] = Hl0*t48+Hl1*(t18*t15)-Hl2*(t23*t15);
                mat[1] = Hl0*t49+Hl1*(t31*t15)-Hl2*(t35*t15);
                mat[2] = -Hl0*t50-Hl1*(t44*t15)+Hl2*(t47*t15);
                mat[3] = Hl3*t48+Hl4*(t18*t15)-Hl5*(t23*t15);
                mat[4] = Hl3*t49+Hl4*(t31*t15)-Hl5*(t35*t15);
                mat[5] = -Hl3*t50-Hl4*(t44*t15)+Hl5*(t47*t15);
                mat[6] = Hl6*t48+Hl7*(t18*t15)-t23*t15;
                mat[7] = Hl6*t49+Hl7*(t31*t15)-t35*t15;
                mat[8] = -Hl6*t50-Hl7*(t44*t15)+t47*t15;
            },

            // The current implementation was derived from *BSD system qsort():
            // Copyright (c) 1992, 1993
            // The Regents of the University of California.  All rights reserved.
            qsort: function(array, low, high, cmp) {
                var isort_thresh = 7;
                var t,ta,tb,tc;
                var sp = 0,left=0,right=0,i=0,n=0,m=0,ptr=0,ptr2=0,d=0;
                var left0=0,left1=0,right0=0,right1=0,pivot=0,a=0,b=0,c=0,swap_cnt=0;

                var stack = qsort_stack;

                if( (high-low+1) <= 1 ) return;

                stack[0] = low;
                stack[1] = high;

                while( sp >= 0 ) {
                
                    left = stack[sp<<1];
                    right = stack[(sp<<1)+1];
                    sp--;

                    for(;;) {
                        n = (right - left) + 1;

                        if( n <= isort_thresh ) {
                        //insert_sort:
                            for( ptr = left + 1; ptr <= right; ptr++ ) {
                                for( ptr2 = ptr; ptr2 > left && cmp(array[ptr2],array[ptr2-1]); ptr2--) {
                                    t = array[ptr2];
                                    array[ptr2] = array[ptr2-1];
                                    array[ptr2-1] = t;
                                }
                            }
                            break;
                        } else {
                            swap_cnt = 0;

                            left0 = left;
                            right0 = right;
                            pivot = left + (n>>1);

                            if( n > 40 ) {
                                d = n >> 3;
                                a = left, b = left + d, c = left + (d<<1);
                                ta = array[a],tb = array[b],tc = array[c];
                                left = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));

                                a = pivot - d, b = pivot, c = pivot + d;
                                ta = array[a],tb = array[b],tc = array[c];
                                pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));

                                a = right - (d<<1), b = right - d, c = right;
                                ta = array[a],tb = array[b],tc = array[c];
                                right = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))
                                                  : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));
                            }

                            a = left, b = pivot, c = right;
                            ta = array[a],tb = array[b],tc = array[c];
                            pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : (cmp(ta, tc) ? c : a))   
                                               : (cmp(tc, tb) ? b : (cmp(ta, tc) ? a : c));
                            if( pivot != left0 ) {
                                t = array[pivot];
                                array[pivot] = array[left0];
                                array[left0] = t;
                                pivot = left0;
                            }
                            left = left1 = left0 + 1;
                            right = right1 = right0;

                            ta = array[pivot];
                            for(;;) {
                                while( left <= right && !cmp(ta, array[left]) ) {
                                    if( !cmp(array[left], ta) ) {
                                        if( left > left1 ) {
                                            t = array[left1];
                                            array[left1] = array[left];
                                            array[left] = t;
                                        }
                                        swap_cnt = 1;
                                        left1++;
                                    }
                                    left++;
                                }

                                while( left <= right && !cmp(array[right], ta) ) {
                                    if( !cmp(ta, array[right]) ) {
                                        if( right < right1 ) {
                                            t = array[right1];
                                            array[right1] = array[right];
                                            array[right] = t;
                                        }
                                        swap_cnt = 1;
                                        right1--;
                                    }
                                    right--;
                                }

                                if( left > right ) break;
                                
                                t = array[left];
                                array[left] = array[right];
                                array[right] = t;
                                swap_cnt = 1;
                                left++;
                                right--;
                            }

                            if( swap_cnt == 0 ) {
                                left = left0, right = right0;
                                //goto insert_sort;
                                for( ptr = left + 1; ptr <= right; ptr++ ) {
                                    for( ptr2 = ptr; ptr2 > left && cmp(array[ptr2],array[ptr2-1]); ptr2--) {
                                        t = array[ptr2];
                                        array[ptr2] = array[ptr2-1];
                                        array[ptr2-1] = t;
                                    }
                                }
                                break;
                            }

                            n = Math.min( (left1 - left0), (left - left1) );
                            m = (left-n)|0;
                            for( i = 0; i < n; ++i,++m ) {
                                t = array[left0+i];
                                array[left0+i] = array[m];
                                array[m] = t;
                            }

                            n = Math.min( (right0 - right1), (right1 - right) );
                            m = (right0-n+1)|0;
                            for( i = 0; i < n; ++i,++m ) {
                                t = array[left+i];
                                array[left+i] = array[m];
                                array[m] = t;
                            }
                            n = (left - left1);
                            m = (right1 - right);
                            if( n > 1 ) {
                                if( m > 1 ) {
                                    if( n > m ) {
                                        ++sp;
                                        stack[sp<<1] = left0;
                                        stack[(sp<<1)+1] = left0 + n - 1;
                                        left = right0 - m + 1, right = right0;
                                    } else {
                                        ++sp;
                                        stack[sp<<1] = right0 - m + 1;
                                        stack[(sp<<1)+1] = right0;
                                        left = left0, right = left0 + n - 1;
                                    }
                                } else {
                                    left = left0, right = left0 + n - 1;
                                }
                            }
                            else if( m > 1 )
                                left = right0 - m + 1, right = right0;
                            else
                                break;
                        }
                    }
                }
            },

            median: function(array, low, high) {
                var w;
                var middle=0,ll=0,hh=0,median=(low+high)>>1;
                for (;;) {
                    if (high <= low) return array[median];
                    if (high == (low + 1)) {
                        if (array[low] > array[high]) {
                            w = array[low];
                            array[low] = array[high];
                            array[high] = w;
                        }
                        return array[median];
                    }
                    middle = ((low + high) >> 1);
                    if (array[middle] > array[high]) {
                        w = array[middle];
                        array[middle] = array[high];
                        array[high] = w;
                    }
                    if (array[low] > array[high]) {
                        w = array[low];
                        array[low] = array[high];
                        array[high] = w;
                    }
                    if (array[middle] > array[low]) {
                        w = array[middle];
                        array[middle] = array[low];
                        array[low] = w;
                    }
                    ll = (low + 1);
                    w = array[middle];
                    array[middle] = array[ll];
                    array[ll] = w;
                    hh = high;
                    for (;;) {
                        do ++ll; while (array[low] > array[ll]);
                        do --hh; while (array[hh] > array[low]);
                        if (hh < ll) break;
                        w = array[ll];
                        array[ll] = array[hh];
                        array[hh] = w;
                    }
                    w = array[low];
                    array[low] = array[hh];
                    array[hh] = w;
                    if (hh <= median)
                        low = ll;
                    else if (hh >= median)
                        high = (hh - 1);
                }
                return 0;
            }
        };

    })();

    global.math = math;

})(jsfeat);

/**
 * @author Eugene Zatepyakin / http://inspirit.ru/
 */

(function(global) {
    "use strict";
    //

    var imgproc = (function() {

        var _resample_u8 = function(src, dst, nw, nh) {
            var xofs_count=0;
            var ch=src.channel,w=src.cols,h=src.rows;
            var src_d=src.data,dst_d=dst.data;
            var scale_x = w / nw, scale_y = h / nh;
            var inv_scale_256 = (scale_x * scale_y * 0x10000)|0;
            var dx=0,dy=0,sx=0,sy=0,sx1=0,sx2=0,i=0,k=0,fsx1=0.0,fsx2=0.0;
            var a=0,b=0,dxn=0,alpha=0,beta=0,beta1=0;

            var buf_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var sum_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var xofs_node = jsfeat.cache.get_buffer((w*2*3)<<2);

            var buf = buf_node.i32;
            var sum = sum_node.i32;
            var xofs = xofs_node.i32;

            for (; dx < nw; dx++) {
                fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
                sx1 = (fsx1 + 1.0 - 1e-6)|0, sx2 = fsx2|0;
                sx1 = Math.min(sx1, w - 1);
                sx2 = Math.min(sx2, w - 1);

                if(sx1 > fsx1) {
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = ((sx1 - 1)*ch)|0; 
                    xofs[k++] = ((sx1 - fsx1) * 0x100)|0;
                    xofs_count++;
                }
                for(sx = sx1; sx < sx2; sx++){
                    xofs_count++;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx * ch)|0;
                    xofs[k++] = 256;
                }
                if(fsx2 - sx2 > 1e-3) {
                    xofs_count++;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx2 * ch)|0;
                    xofs[k++] = ((fsx2 - sx2) * 256)|0;
                }
            }

            for (dx = 0; dx < nw * ch; dx++) {
                buf[dx] = sum[dx] = 0;
            }
            dy = 0;
            for (sy = 0; sy < h; sy++) {
                a = w * sy;
                for (k = 0; k < xofs_count; k++) {
                    dxn = xofs[k*3];
                    sx1 = xofs[k*3+1];
                    alpha = xofs[k*3+2];
                    for (i = 0; i < ch; i++) {
                        buf[dxn + i] += src_d[a+sx1+i] * alpha;
                    }
                }
                if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
                    beta = (Math.max(sy + 1 - (dy + 1) * scale_y, 0.0) * 256)|0;
                    beta1 = 256 - beta;
                    b = nw * dy;
                    if (beta <= 0) {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = Math.min(Math.max((sum[dx] + buf[dx] * 256) / inv_scale_256, 0), 255);
                            sum[dx] = buf[dx] = 0;
                        }
                    } else {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = Math.min(Math.max((sum[dx] + buf[dx] * beta1) / inv_scale_256, 0), 255);
                            sum[dx] = buf[dx] * beta;
                            buf[dx] = 0;
                        }
                    }
                    dy++;
                } else {
                    for(dx = 0; dx < nw * ch; dx++) {
                        sum[dx] += buf[dx] * 256;
                        buf[dx] = 0;
                    }
                }
            }

            jsfeat.cache.put_buffer(sum_node);
            jsfeat.cache.put_buffer(buf_node);
            jsfeat.cache.put_buffer(xofs_node);
        }

        var _resample = function(src, dst, nw, nh) {
            var xofs_count=0;
            var ch=src.channel,w=src.cols,h=src.rows;
            var src_d=src.data,dst_d=dst.data;
            var scale_x = w / nw, scale_y = h / nh;
            var scale = 1.0 / (scale_x * scale_y);
            var dx=0,dy=0,sx=0,sy=0,sx1=0,sx2=0,i=0,k=0,fsx1=0.0,fsx2=0.0;
            var a=0,b=0,dxn=0,alpha=0.0,beta=0.0,beta1=0.0;

            var buf_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var sum_node = jsfeat.cache.get_buffer((nw*ch)<<2);
            var xofs_node = jsfeat.cache.get_buffer((w*2*3)<<2);

            var buf = buf_node.f32;
            var sum = sum_node.f32;
            var xofs = xofs_node.f32;

            for (; dx < nw; dx++) {
                fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
                sx1 = (fsx1 + 1.0 - 1e-6)|0, sx2 = fsx2|0;
                sx1 = Math.min(sx1, w - 1);
                sx2 = Math.min(sx2, w - 1);

                if(sx1 > fsx1) {
                    xofs_count++;
                    xofs[k++] = ((sx1 - 1)*ch)|0;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (sx1 - fsx1) * scale;
                }
                for(sx = sx1; sx < sx2; sx++){
                    xofs_count++;
                    xofs[k++] = (sx * ch)|0;
                    xofs[k++] = (dx * ch)|0; 
                    xofs[k++] = scale;
                }
                if(fsx2 - sx2 > 1e-3) {
                    xofs_count++;
                    xofs[k++] = (sx2 * ch)|0;
                    xofs[k++] = (dx * ch)|0;
                    xofs[k++] = (fsx2 - sx2) * scale;
                }
            }

            for (dx = 0; dx < nw * ch; dx++) {
                buf[dx] = sum[dx] = 0;
            }
            dy = 0;
            for (sy = 0; sy < h; sy++) {
                a = w * sy;
                for (k = 0; k < xofs_count; k++) {
                    sx1 = xofs[k*3]|0;
                    dxn = xofs[k*3+1]|0;
                    alpha = xofs[k*3+2];
                    for (i = 0; i < ch; i++) {
                        buf[dxn + i] += src_d[a+sx1+i] * alpha;
                    }
                }
                if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
                    beta = Math.max(sy + 1 - (dy + 1) * scale_y, 0.0);
                    beta1 = 1.0 - beta;
                    b = nw * dy;
                    if (Math.abs(beta) < 1e-3) {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = sum[dx] + buf[dx];
                            sum[dx] = buf[dx] = 0;
                        }
                    } else {
                        for (dx = 0; dx < nw * ch; dx++) {
                            dst_d[b+dx] = sum[dx] + buf[dx] * beta1;
                            sum[dx] = buf[dx] * beta;
                            buf[dx] = 0;
                        }
                    }
                    dy++;
                } else {
                    for(dx = 0; dx < nw * ch; dx++) {
                        sum[dx] += buf[dx]; 
                        buf[dx] = 0;
                    }
                }
            }
            jsfeat.cache.put_buffer(sum_node);
            jsfeat.cache.put_buffer(buf_node);
            jsfeat.cache.put_buffer(xofs_node);
        }

        var _convol_u8 = function(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel) {
            var i=0,j=0,k=0,sp=0,dp=0,sum=0,sum1=0,sum2=0,sum3=0,f0=filter[0],fk=0;
            var w2=w<<1,w3=w*3,w4=w<<2;
            // hor pass
            for (; i < h; ++i) { 
                sum = src_d[sp];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                for (j = 0; j <= w-2; j+=2) {
                    buf[j + half_kernel] = src_d[sp+j];
                    buf[j + half_kernel+1] = src_d[sp+j+1];
                }
                for (; j < w; ++j) {
                    buf[j + half_kernel] = src_d[sp+j];
                }
                sum = src_d[sp+w-1];
                for (j = w; j < half_kernel + w; ++j) {
                    buf[j + half_kernel] = sum;
                }
                for (j = 0; j <= w-4; j+=4) {
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp+j] = Math.min(sum >> 8, 255);
                    dst_d[dp+j+1] = Math.min(sum1 >> 8, 255);
                    dst_d[dp+j+2] = Math.min(sum2 >> 8, 255);
                    dst_d[dp+j+3] = Math.min(sum3 >> 8, 255);
                }
                for (; j < w; ++j) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp+j] = Math.min(sum >> 8, 255);
                }
                sp += w;
                dp += w;
            }

            // vert pass
            for (i = 0; i < w; ++i) {
                sum = dst_d[i];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                k = i;
                for (j = 0; j <= h-2; j+=2, k+=w2) {
                    buf[j+half_kernel] = dst_d[k];
                    buf[j+half_kernel+1] = dst_d[k+w];
                }
                for (; j < h; ++j, k+=w) {
                    buf[j+half_kernel] = dst_d[k];
                }
                sum = dst_d[(h-1)*w + i];
                for (j = h; j < half_kernel + h; ++j) {
                    buf[j + half_kernel] = sum;
                }
                dp = i;
                for (j = 0; j <= h-4; j+=4, dp+=w4) { 
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp] = Math.min(sum >> 8, 255);
                    dst_d[dp+w] = Math.min(sum1 >> 8, 255);
                    dst_d[dp+w2] = Math.min(sum2 >> 8, 255);
                    dst_d[dp+w3] = Math.min(sum3 >> 8, 255);
                }
                for (; j < h; ++j, dp+=w) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp] = Math.min(sum >> 8, 255);
                }
            }
        }

        var _convol = function(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel) {
            var i=0,j=0,k=0,sp=0,dp=0,sum=0.0,sum1=0.0,sum2=0.0,sum3=0.0,f0=filter[0],fk=0.0;
            var w2=w<<1,w3=w*3,w4=w<<2;
            // hor pass
            for (; i < h; ++i) { 
                sum = src_d[sp];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                for (j = 0; j <= w-2; j+=2) {
                    buf[j + half_kernel] = src_d[sp+j];
                    buf[j + half_kernel+1] = src_d[sp+j+1];
                }
                for (; j < w; ++j) {
                    buf[j + half_kernel] = src_d[sp+j];
                }
                sum = src_d[sp+w-1];
                for (j = w; j < half_kernel + w; ++j) {
                    buf[j + half_kernel] = sum;
                }
                for (j = 0; j <= w-4; j+=4) {
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp+j] = sum;
                    dst_d[dp+j+1] = sum1;
                    dst_d[dp+j+2] = sum2;
                    dst_d[dp+j+3] = sum3;
                }
                for (; j < w; ++j) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp+j] = sum;
                }
                sp += w;
                dp += w;
            }

            // vert pass
            for (i = 0; i < w; ++i) {
                sum = dst_d[i];
                for (j = 0; j < half_kernel; ++j) {
                    buf[j] = sum;
                }
                k = i;
                for (j = 0; j <= h-2; j+=2, k+=w2) {
                    buf[j+half_kernel] = dst_d[k];
                    buf[j+half_kernel+1] = dst_d[k+w];
                }
                for (; j < h; ++j, k+=w) {
                    buf[j+half_kernel] = dst_d[k];
                }
                sum = dst_d[(h-1)*w + i];
                for (j = h; j < half_kernel + h; ++j) {
                    buf[j + half_kernel] = sum;
                }
                dp = i;
                for (j = 0; j <= h-4; j+=4, dp+=w4) { 
                    sum = buf[j] * f0, 
                    sum1 = buf[j+1] * f0,
                    sum2 = buf[j+2] * f0,
                    sum3 = buf[j+3] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        fk = filter[k];
                        sum += buf[k + j] * fk;
                        sum1 += buf[k + j+1] * fk;
                        sum2 += buf[k + j+2] * fk;
                        sum3 += buf[k + j+3] * fk;
                    }
                    dst_d[dp] = sum;
                    dst_d[dp+w] = sum1;
                    dst_d[dp+w2] = sum2;
                    dst_d[dp+w3] = sum3;
                }
                for (; j < h; ++j, dp+=w) {
                    sum = buf[j] * f0;
                    for (k = 1; k < kernel_size; ++k) {
                        sum += buf[k + j] * filter[k];
                    }
                    dst_d[dp] = sum;
                }
            }
        }

        return {
            // TODO: add support for RGB/BGR order
            // for raw arrays
            grayscale: function(src, dst) {
                var srcLength = src.length|0, srcLength_16 = (srcLength - 16)|0;
                var j = 0;
                var coeff_r = 4899, coeff_g = 9617, coeff_b = 1868;

                for (var i = 0; i <= srcLength_16; i += 16, j += 4) {
                    dst[j]     = (src[i] * coeff_r + src[i+1] * coeff_g + src[i+2] * coeff_b + 8192) >> 14;
                    dst[j + 1] = (src[i+4] * coeff_r + src[i+5] * coeff_g + src[i+6] * coeff_b + 8192) >> 14;
                    dst[j + 2] = (src[i+8] * coeff_r + src[i+9] * coeff_g + src[i+10] * coeff_b + 8192) >> 14;
                    dst[j + 3] = (src[i+12] * coeff_r + src[i+13] * coeff_g + src[i+14] * coeff_b + 8192) >> 14;
                }
                for (; i < srcLength; i += 4, ++j) {
                    dst[j] = (src[i] * coeff_r + src[i+1] * coeff_g + src[i+2] * coeff_b + 8192) >> 14;
                }
            },
            // derived from CCV library
            resample: function(src, dst, nw, nh) {
                var h=src.rows,w=src.cols;
                if (h > nh && w > nw) {
                    // using the fast alternative (fix point scale, 0x100 to avoid overflow)
                    if (src.type&jsfeat.U8_t && dst.type&jsfeat.U8_t && h * w / (nh * nw) < 0x100) {
                        _resample_u8(src, dst, nw, nh);
                    } else {
                        _resample(src, dst, nw, nh);
                    }
                }
            },

            box_blur_gray: function(src, dst, radius, options) {
                if (typeof options === "undefined") { options = 0; }
                var w=src.cols, h=src.rows, h2=h<<1, w2=w<<1;
                var i=0,x=0,y=0,end=0;
                var windowSize = ((radius << 1) + 1)|0;
                var radiusPlusOne = (radius + 1)|0, radiusPlus2 = (radiusPlusOne+1)|0;
                var scale = options&jsfeat.BOX_BLUR_NOSCALE ? 1 : (1.0 / (windowSize*windowSize));

                var tmp_buff = jsfeat.cache.get_buffer((w*h)<<2);

                var sum=0, dstIndex=0, srcIndex = 0, nextPixelIndex=0, previousPixelIndex=0;
                var data_i32 = tmp_buff.i32; // to prevent overflow
                var data_u8 = src.data;
                var hold=0;

                // first pass
                // no need to scale 
                //data_u8 = src.data;
                //data_i32 = tmp;
                for (y = 0; y < h; ++y) {
                    dstIndex = y;
                    sum = radiusPlusOne * data_u8[srcIndex];

                    for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                        sum += data_u8[i];
                    }

                    nextPixelIndex = (srcIndex + radiusPlusOne)|0;
                    previousPixelIndex = srcIndex;
                    hold = data_u8[previousPixelIndex];
                    for(x = 0; x < radius; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- hold;
                        nextPixelIndex ++;
                    }
                    for(; x < w-radiusPlus2; x+=2, dstIndex += h2) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- data_u8[previousPixelIndex];

                        data_i32[dstIndex+h] = sum;
                        sum += data_u8[nextPixelIndex+1]- data_u8[previousPixelIndex+1];

                        nextPixelIndex +=2;
                        previousPixelIndex +=2;
                    }
                    for(; x < w-radiusPlusOne; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;
                        sum += data_u8[nextPixelIndex]- data_u8[previousPixelIndex];

                        nextPixelIndex ++;
                        previousPixelIndex ++;
                    }
                    
                    hold = data_u8[nextPixelIndex-1];
                    for(; x < w; ++x, dstIndex += h) {
                        data_i32[dstIndex] = sum;

                        sum += hold- data_u8[previousPixelIndex];
                        previousPixelIndex ++;
                    }

                    srcIndex += w;
                }
                //
                // second pass
                srcIndex = 0;
                //data_i32 = tmp; // this is a transpose
                data_u8 = dst.data;

                // dont scale result
                if(scale == 1) {
                    for (y = 0; y < w; ++y) {
                        dstIndex = y;
                        sum = radiusPlusOne * data_i32[srcIndex];

                        for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                            sum += data_i32[i];
                        }

                        nextPixelIndex = srcIndex + radiusPlusOne;
                        previousPixelIndex = srcIndex;
                        hold = data_i32[previousPixelIndex];

                        for(x = 0; x < radius; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;
                            sum += data_i32[nextPixelIndex]- hold;
                            nextPixelIndex ++;
                        }
                        for(; x < h-radiusPlus2; x+=2, dstIndex += w2) {
                            data_u8[dstIndex] = sum;
                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];

                            data_u8[dstIndex+w] = sum;
                            sum += data_i32[nextPixelIndex+1]- data_i32[previousPixelIndex+1];

                            nextPixelIndex +=2;
                            previousPixelIndex +=2;
                        }
                        for(; x < h-radiusPlusOne; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;

                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];
                            nextPixelIndex ++;
                            previousPixelIndex ++;
                        }
                        hold = data_i32[nextPixelIndex-1];
                        for(; x < h; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum;

                            sum += hold- data_i32[previousPixelIndex];
                            previousPixelIndex ++;
                        }

                        srcIndex += h;
                    }
                } else {
                    for (y = 0; y < w; ++y) {
                        dstIndex = y;
                        sum = radiusPlusOne * data_i32[srcIndex];

                        for(i = (srcIndex+1)|0, end=(srcIndex+radius)|0; i <= end; ++i) {
                            sum += data_i32[i];
                        }

                        nextPixelIndex = srcIndex + radiusPlusOne;
                        previousPixelIndex = srcIndex;
                        hold = data_i32[previousPixelIndex];

                        for(x = 0; x < radius; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;
                            sum += data_i32[nextPixelIndex]- hold;
                            nextPixelIndex ++;
                        }
                        for(; x < h-radiusPlus2; x+=2, dstIndex += w2) {
                            data_u8[dstIndex] = sum*scale;
                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];

                            data_u8[dstIndex+w] = sum*scale;
                            sum += data_i32[nextPixelIndex+1]- data_i32[previousPixelIndex+1];

                            nextPixelIndex +=2;
                            previousPixelIndex +=2;
                        }
                        for(; x < h-radiusPlusOne; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;

                            sum += data_i32[nextPixelIndex]- data_i32[previousPixelIndex];
                            nextPixelIndex ++;
                            previousPixelIndex ++;
                        }
                        hold = data_i32[nextPixelIndex-1];
                        for(; x < h; ++x, dstIndex += w) {
                            data_u8[dstIndex] = sum*scale;

                            sum += hold- data_i32[previousPixelIndex];
                            previousPixelIndex ++;
                        }

                        srcIndex += h;
                    }
                }

                jsfeat.cache.put_buffer(tmp_buff);
            },

            gaussian_blur: function(src, dst, kernel_size, sigma) {
                if (typeof sigma === "undefined") { sigma = 0.0; }
                if (typeof kernel_size === "undefined") { kernel_size = 0; }
                kernel_size = kernel_size == 0 ? (Math.max(1, (4.0 * sigma + 1.0 - 1e-8)) * 2 + 1)|0 : kernel_size;
                var half_kernel = kernel_size >> 1;
                var w = src.cols, h = src.rows;
                var data_type = src.type, is_u8 = data_type&jsfeat.U8_t;
                var src_d = src.data, dst_d = dst.data;
                var buf,filter,buf_sz=(kernel_size + Math.max(h, w))|0;

                var buf_node = jsfeat.cache.get_buffer(buf_sz<<2);
                var filt_node = jsfeat.cache.get_buffer(kernel_size<<2);

                if(is_u8) {
                    buf = buf_node.i32;
                    filter = filt_node.i32;
                } else if(data_type&jsfeat.S32_t) {
                    buf = buf_node.i32;
                    filter = filt_node.f32;
                } else {
                    buf = buf_node.f32;
                    filter = filt_node.f32;
                }

                jsfeat.math.get_gaussian_kernel(kernel_size, sigma, filter, data_type);

                if(is_u8) {
                    _convol_u8(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel);
                } else {
                    _convol(buf, src_d, dst_d, w, h, filter, kernel_size, half_kernel);
                }

                jsfeat.cache.put_buffer(buf_node);
                jsfeat.cache.put_buffer(filt_node);
            },
            // assume we always need it for u8 image
            pyrdown: function(src, dst, sx, sy) {
                // this is needed for bbf
                if (typeof sx === "undefined") { sx = 0; }
                if (typeof sy === "undefined") { sy = 0; }

                var w = src.cols, h = src.rows;
                var w2 = w >> 1, h2 = h >> 1;
                var _w2 = w2 - (sx << 1), _h2 = h2 - (sy << 1);
                var x=0,y=0,sptr=sx+sy*w,sline=0,dptr=0,dline=0;
                var src_d = src.data, dst_d = dst.data;

                for(y = 0; y < _h2; ++y) {
                    sline = sptr;
                    dline = dptr;
                    for(x = 0; x <= _w2-2; x+=2, dline+=2, sline += 4) {
                        dst_d[dline] = (src_d[sline] + src_d[sline+1] +
                                            src_d[sline+w] + src_d[sline+w+1] + 2) >> 2;
                        dst_d[dline+1] = (src_d[sline+2] + src_d[sline+3] +
                                            src_d[sline+w+2] + src_d[sline+w+3] + 2) >> 2;
                    }
                    for(; x < _w2; ++x, ++dline, sline += 2) {
                        dst_d[dline] = (src_d[sline] + src_d[sline+1] +
                                            src_d[sline+w] + src_d[sline+w+1] + 2) >> 2;
                    }
                    sptr += w << 1;
                    dptr += w2;
                }
            },

            // dst: [gx,gy,...]
            scharr_derivatives: function(src, dst) {
                var w = src.cols, h = src.rows;
                var dstep = w<<1,x=0,y=0,x1=0,a,b,c,d,e,f;
                var srow0=0,srow1=0,srow2=0,drow=0;
                var trow0,trow1;
                var img = src.data, gxgy=dst.data;

                var buf0_node = jsfeat.cache.get_buffer((w+2)<<2);
                var buf1_node = jsfeat.cache.get_buffer((w+2)<<2);

                if(src.type&jsfeat.U8_t || src.type&jsfeat.S32_t) {
                    trow0 = buf0_node.i32;
                    trow1 = buf1_node.i32;
                } else {
                    trow0 = buf0_node.f32;
                    trow1 = buf1_node.f32;
                }

                for(; y < h; ++y, srow1+=w) {
                    srow0 = ((y > 0 ? y-1 : 1)*w)|0;
                    srow2 = ((y < h-1 ? y+1 : h-2)*w)|0;
                    drow = (y*dstep)|0;
                    // do vertical convolution
                    for(x = 0, x1 = 1; x <= w-2; x+=2, x1+=2) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b)*3 + (img[srow1+x])*10 );
                        trow1[x1] = ( b - a );
                        //
                        a = img[srow0+x+1], b = img[srow2+x+1];
                        trow0[x1+1] = ( (a + b)*3 + (img[srow1+x+1])*10 );
                        trow1[x1+1] = ( b - a );
                    }
                    for(; x < w; ++x, ++x1) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b)*3 + (img[srow1+x])*10 );
                        trow1[x1] = ( b - a );
                    }
                    // make border
                    x = (w + 1)|0;
                    trow0[0] = trow0[1]; trow0[x] = trow0[w];
                    trow1[0] = trow1[1]; trow1[x] = trow1[w];
                    // do horizontal convolution, interleave the results and store them
                    for(x = 0; x <= w-4; x+=4) {
                        a = trow1[x+2], b = trow1[x+1], c = trow1[x+3], d = trow1[x+4],
                        e = trow0[x+2], f = trow0[x+3];
                        gxgy[drow++] = ( e - trow0[x] );
                        gxgy[drow++] = ( (a + trow1[x])*3 + b*10 );
                        gxgy[drow++] = ( f - trow0[x+1] );
                        gxgy[drow++] = ( (c + b)*3 + a*10 );

                        gxgy[drow++] = ( (trow0[x+4] - e) );
                        gxgy[drow++] = ( ((d + a)*3 + c*10) );
                        gxgy[drow++] = ( (trow0[x+5] - f) );
                        gxgy[drow++] = ( ((trow1[x+5] + c)*3 + d*10) );
                    }
                    for(; x < w; ++x) {
                        gxgy[drow++] = ( (trow0[x+2] - trow0[x]) );
                        gxgy[drow++] = ( ((trow1[x+2] + trow1[x])*3 + trow1[x+1]*10) );
                    }
                }
                jsfeat.cache.put_buffer(buf0_node);
                jsfeat.cache.put_buffer(buf1_node);
            },

            // compute gradient using Sobel kernel [1 2 1] * [-1 0 1]^T
            // dst: [gx,gy,...]
            sobel_derivatives: function(src, dst) {
                var w = src.cols, h = src.rows;
                var dstep = w<<1,x=0,y=0,x1=0,a,b,c,d,e,f;
                var srow0=0,srow1=0,srow2=0,drow=0;
                var trow0,trow1;
                var img = src.data, gxgy=dst.data;

                var buf0_node = jsfeat.cache.get_buffer((w+2)<<2);
                var buf1_node = jsfeat.cache.get_buffer((w+2)<<2);

                if(src.type&jsfeat.U8_t || src.type&jsfeat.S32_t) {
                    trow0 = buf0_node.i32;
                    trow1 = buf1_node.i32;
                } else {
                    trow0 = buf0_node.f32;
                    trow1 = buf1_node.f32;
                }

                for(; y < h; ++y, srow1+=w) {
                    srow0 = ((y > 0 ? y-1 : 1)*w)|0;
                    srow2 = ((y < h-1 ? y+1 : h-2)*w)|0;
                    drow = (y*dstep)|0;
                    // do vertical convolution
                    for(x = 0, x1 = 1; x <= w-2; x+=2, x1+=2) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b) + (img[srow1+x]*2) );
                        trow1[x1] = ( b - a );
                        //
                        a = img[srow0+x+1], b = img[srow2+x+1];
                        trow0[x1+1] = ( (a + b) + (img[srow1+x+1]*2) );
                        trow1[x1+1] = ( b - a );
                    }
                    for(; x < w; ++x, ++x1) {
                        a = img[srow0+x], b = img[srow2+x];
                        trow0[x1] = ( (a + b) + (img[srow1+x]*2) );
                        trow1[x1] = ( b - a );
                    }
                    // make border
                    x = (w + 1)|0;
                    trow0[0] = trow0[1]; trow0[x] = trow0[w];
                    trow1[0] = trow1[1]; trow1[x] = trow1[w];
                    // do horizontal convolution, interleave the results and store them
                    for(x = 0; x <= w-4; x+=4) {
                        a = trow1[x+2], b = trow1[x+1], c = trow1[x+3], d = trow1[x+4],
                        e = trow0[x+2], f = trow0[x+3];
                        gxgy[drow++] = ( e - trow0[x] );
                        gxgy[drow++] = ( a + trow1[x] + b*2 );
                        gxgy[drow++] = ( f - trow0[x+1] );
                        gxgy[drow++] = ( c + b + a*2 );

                        gxgy[drow++] = ( trow0[x+4] - e );
                        gxgy[drow++] = ( d + a + c*2 );
                        gxgy[drow++] = ( trow0[x+5] - f );
                        gxgy[drow++] = ( trow1[x+5] + c + d*2 );
                    }
                    for(; x < w; ++x) {
                        gxgy[drow++] = ( trow0[x+2] - trow0[x] );
                        gxgy[drow++] = ( trow1[x+2] + trow1[x] + trow1[x+1]*2 );
                    }
                }
                jsfeat.cache.put_buffer(buf0_node);
                jsfeat.cache.put_buffer(buf1_node);
            },

            // please note: 
            // dst_(type) size should be cols = src.cols+1, rows = src.rows+1
            compute_integral_image: function(src, dst_sum, dst_sqsum, dst_tilted) {
                var w0=src.cols|0,h0=src.rows|0,src_d=src.data;
                var w1=(w0+1)|0;
                var s=0,s2=0,p=0,pup=0,i=0,j=0,v=0,k=0;

                if(dst_sum && dst_sqsum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sum[i] = 0, dst_sqsum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s = s2 = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            v = src_d[k];
                            s += v, s2 += v*v;
                            dst_sum[p] = dst_sum[pup] + s;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;

                            v = src_d[k+1];
                            s += v, s2 += v*v;
                            dst_sum[p+1] = dst_sum[pup+1] + s;
                            dst_sqsum[p+1] = dst_sqsum[pup+1] + s2;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            v = src_d[k];
                            s += v, s2 += v*v;
                            dst_sum[p] = dst_sum[pup] + s;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                        }
                    }
                } else if(dst_sum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            s += src_d[k];
                            dst_sum[p] = dst_sum[pup] + s;
                            s += src_d[k+1];
                            dst_sum[p+1] = dst_sum[pup+1] + s;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            s += src_d[k];
                            dst_sum[p] = dst_sum[pup] + s;
                        }
                    }
                } else if(dst_sqsum) {
                    // fill first row with zeros
                    for(; i < w1; ++i) {
                        dst_sqsum[i] = 0;
                    }
                    p = (w1+1)|0, pup = 1;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        s2 = 0;
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            v = src_d[k];
                            s2 += v*v;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                            v = src_d[k+1];
                            s2 += v*v;
                            dst_sqsum[p+1] = dst_sqsum[pup+1] + s2;
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            v = src_d[k];
                            s2 += v*v;
                            dst_sqsum[p] = dst_sqsum[pup] + s2;
                        }
                    }
                }

                if(dst_tilted) {
                    // fill first row with zeros
                    for(i = 0; i < w1; ++i) {
                        dst_tilted[i] = 0;
                    }
                    // diagonal
                    p = (w1+1)|0, pup = 0;
                    for(i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
                        for(j = 0; j <= w0-2; j+=2, k+=2, p+=2, pup+=2) {
                            dst_tilted[p] = src_d[k] + dst_tilted[pup];
                            dst_tilted[p+1] = src_d[k+1] + dst_tilted[pup+1];
                        }
                        for(; j < w0; ++j, ++k, ++p, ++pup) {
                            dst_tilted[p] = src_d[k] + dst_tilted[pup];
                        }
                    }
                    // diagonal
                    p = (w1+w0)|0, pup = w0;
                    for(i = 0; i < h0; ++i, p+=w1, pup+=w1) {
                        dst_tilted[p] += dst_tilted[pup];
                    }

                    for(j = w0-1; j > 0; --j) {
                        p = j+h0*w1, pup=p-w1;
                        for(i = h0; i > 0; --i, p-=w1, pup-=w1) {
                            dst_tilted[p] += dst_tilted[pup] + dst_tilted[pup+1];
                        }
                    }
                }
            },
            equalize_histogram: function(src, dst) {
                var w=src.cols,h=src.rows,src_d=src.data,dst_d=dst.data,size=w*h;
                var i=0,prev=0,hist0,norm;

                var hist0_node = jsfeat.cache.get_buffer(256<<2);
                hist0 = hist0_node.i32;
                for(; i < 256; ++i) hist0[i] = 0;
                for (i = 0; i < size; ++i) {
                    ++hist0[src_d[i]];
                }

                prev = hist0[0];
                for (i = 1; i < 256; ++i) {
                    prev = hist0[i] += prev;
                }

                norm = 255 / size;
                for (i = 0; i < size; ++i) {
                    dst_d[i] = (hist0[src_d[i]] * norm + 0.5)|0;
                }
                jsfeat.cache.put_buffer(hist0_node);
            },

            canny: function(src, dst, low_thresh, high_thresh) {
                var w=src.cols,h=src.rows,src_d=src.data,dst_d=dst.data;
                var i=0,j=0,grad=0,w2=w<<1,_grad=0,suppress=0,f=0,x=0,y=0,s=0;
                var tg22x=0,tg67x=0;

                // cache buffers
                var dxdy_node = jsfeat.cache.get_buffer((h * w2)<<2);
                var buf_node = jsfeat.cache.get_buffer((3 * (w + 2))<<2);
                var map_node = jsfeat.cache.get_buffer(((h+2) * (w + 2))<<2);
                var stack_node = jsfeat.cache.get_buffer((h * w)<<2);
                

                var buf = buf_node.i32;
                var map = map_node.i32;
                var stack = stack_node.i32;
                var dxdy = dxdy_node.i32;
                var dxdy_m = new jsfeat.matrix_t(w, h, jsfeat.S32C2_t, dxdy_node.data);
                var row0=1,row1=(w+2+1)|0,row2=(2*(w+2)+1)|0,map_w=(w+2)|0,map_i=(map_w+1)|0,stack_i=0;

                this.sobel_derivatives(src, dxdy_m);

                if(low_thresh > high_thresh) {
                    i = low_thresh;
                    low_thresh = high_thresh;
                    high_thresh = i;
                }

                i = (3 * (w + 2))|0;
                while(--i>=0) {
                    buf[i] = 0;
                }

                i = ((h+2) * (w + 2))|0;
                while(--i>=0) {
                    map[i] = 0;
                }

                for (; j < w; ++j, grad+=2) {
                    //buf[row1+j] = Math.abs(dxdy[grad]) + Math.abs(dxdy[grad+1]);
                    x = dxdy[grad], y = dxdy[grad+1];
                    //buf[row1+j] = x*x + y*y;
                    buf[row1+j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
                }

                for(i=1; i <= h; ++i, grad+=w2) {
                    if(i == h) {
                        j = row2+w;
                        while(--j>=row2) {
                            buf[j] = 0;
                        }
                    } else {
                        for (j = 0; j < w; j++) {
                            //buf[row2+j] =  Math.abs(dxdy[grad+(j<<1)]) + Math.abs(dxdy[grad+(j<<1)+1]);
                            x = dxdy[grad+(j<<1)], y = dxdy[grad+(j<<1)+1];
                            //buf[row2+j] = x*x + y*y;
                            buf[row2+j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
                        }
                    }
                    _grad = (grad - w2)|0;
                    map[map_i-1] = 0;
                    suppress = 0;
                    for(j = 0; j < w; ++j, _grad+=2) {
                        f = buf[row1+j];
                        if (f > low_thresh) {
                            x = dxdy[_grad];
                            y = dxdy[_grad+1];
                            s = x ^ y;
                            // seems ot be faster than Math.abs
                            x = ((x ^ (x >> 31)) - (x >> 31))|0;
                            y = ((y ^ (y >> 31)) - (y >> 31))|0;
                            //x * tan(22.5) x * tan(67.5) == 2 * x + x * tan(22.5)
                            tg22x = x * 13573;
                            tg67x = tg22x + ((x + x) << 15);
                            y <<= 15;
                            if (y < tg22x) {
                                if (f > buf[row1+j-1] && f >= buf[row1+j+1]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            } else if (y > tg67x) {
                                if (f > buf[row0+j] && f >= buf[row2+j]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            } else {
                                s = s < 0 ? -1 : 1;
                                if (f > buf[row0+j-s] && f > buf[row2+j+s]) {
                                    if (f > high_thresh && !suppress && map[map_i+j-map_w] != 2) {
                                        map[map_i+j] = 2;
                                        suppress = 1;
                                        stack[stack_i++] = map_i + j;
                                    } else {
                                        map[map_i+j] = 1;
                                    }
                                    continue;
                                }
                            }
                        }
                        map[map_i+j] = 0;
                        suppress = 0;
                    }
                    map[map_i+w] = 0;
                    map_i += map_w;
                    j = row0;
                    row0 = row1;
                    row1 = row2;
                    row2 = j;
                }

                j = map_i - map_w - 1;
                for(i = 0; i < map_w; ++i, ++j) {
                    map[j] = 0;
                }
                // path following
                while(stack_i > 0) {
                    map_i = stack[--stack_i];
                    map_i -= map_w+1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += map_w;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i -= 2;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += map_w;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                    map_i += 1;
                    if(map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
                }

                map_i = map_w + 1;
                row0 = 0;
                for(i = 0; i < h; ++i, map_i+=map_w) {
                    for(j = 0; j < w; ++j) {
                        dst_d[row0++] = (map[map_i+j] == 2) * 0xff;
                    }
                }

                // free buffers
                jsfeat.cache.put_buffer(dxdy_node);
                jsfeat.cache.put_buffer(buf_node);
                jsfeat.cache.put_buffer(map_node);
                jsfeat.cache.put_buffer(stack_node);
            },
            // transform is 3x3 matrix_t
            warp_perspective: function(src, dst, transform, fill_value) {
                if (typeof fill_value === "undefined") { fill_value = 0; }
                var src_width=src.cols|0, src_height=src.rows|0, dst_width=dst.cols|0, dst_height=dst.rows|0;
                var src_d=src.data, dst_d=dst.data;
                var x=0,y=0,off=0,ixs=0,iys=0,xs=0.0,ys=0.0,xs0=0.0,ys0=0.0,ws=0.0,sc=0.0,a=0.0,b=0.0,p0=0.0,p1=0.0;
                var td=transform.data;
                var m00=td[0],m01=td[1],m02=td[2],
                    m10=td[3],m11=td[4],m12=td[5],
                    m20=td[6],m21=td[7],m22=td[8];

                for(var dptr = 0; y < dst_height; ++y) {
                    xs0 = m01 * y + m02,
                    ys0 = m11 * y + m12,
                    ws  = m21 * y + m22;
                    for(x = 0; x < dst_width; ++x, ++dptr, xs0+=m00, ys0+=m10, ws+=m20) {
                        sc = 1.0 / ws;
                        xs = xs0 * sc, ys = ys0 * sc;
                        ixs = xs | 0, iys = ys | 0;

                        if(xs > 0 && ys > 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
                            a = Math.max(xs - ixs, 0.0);
                            b = Math.max(ys - iys, 0.0);
                            off = (src_width*iys + ixs)|0;

                            p0 = src_d[off] +  a * (src_d[off+1] - src_d[off]);
                            p1 = src_d[off+src_width] + a * (src_d[off+src_width+1] - src_d[off+src_width]);

                            dst_d[dptr] = p0 + b * (p1 - p0);
                        }
                        else dst_d[dptr] = fill_value;
                    }
                }
            },
            // transform is 3x3 or 2x3 matrix_t only first 6 values referenced
            warp_affine: function(src, dst, transform, fill_value) {
                if (typeof fill_value === "undefined") { fill_value = 0; }
                var src_width=src.cols, src_height=src.rows, dst_width=dst.cols, dst_height=dst.rows;
                var src_d=src.data, dst_d=dst.data;
                var x=0,y=0,off=0,ixs=0,iys=0,xs=0.0,ys=0.0,a=0.0,b=0.0,p0=0.0,p1=0.0;
                var td=transform.data;
                var m00=td[0],m01=td[1],m02=td[2],
                    m10=td[3],m11=td[4],m12=td[5];

                for(var dptr = 0; y < dst_height; ++y) {
                    xs = m01 * y + m02;
                    ys = m11 * y + m12;
                    for(x = 0; x < dst_width; ++x, ++dptr, xs+=m00, ys+=m10) {
                        ixs = xs | 0; iys = ys | 0;

                        if(xs > 0 && ys > 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
                            a = Math.max(xs - ixs, 0.0);
                            b = Math.max(ys - iys, 0.0);
                            off = src_width*iys + ixs;

                            p0 = src_d[off] +  a * (src_d[off+1] - src_d[off]);
                            p1 = src_d[off+src_width] + a * (src_d[off+src_width+1] - src_d[off+src_width]);

                            dst_d[dptr] = p0 + b * (p1 - p0);
                        }
                        else dst_d[dptr] = fill_value;
                    }
                }
            }
        };
    })();

    global.imgproc = imgproc;

})(jsfeat);
/*
  This implementation is very loosely based off js-priority-queue
  by Adam Hooper from https://github.com/adamhooper/js-priority-queue
  
  The js-priority-queue implementation seemed a teensy bit bloated
  with its require.js dependency and multiple storage strategies
  when all but one were strongly discouraged. So here is a kind of 
  condensed version of the functionality with only the features that
  I particularly needed. 

  Using it is pretty simple, you just create an instance of HeapQueue
  while optionally specifying a comparator as the argument:

  var heapq = new HeapQueue()

  var customq = new HeapQueue(function(a, b){
  	// if b > a, return negative
  	// means that it spits out the smallest item first
	return a - b
  })

  Note that in this case, the default comparator is identical to
  the comparator which is used explicitly in the second queue.

  Once you've initialized the heapqueue, you can plop some new
  elements into the queue with the push method (vaguely reminiscent
  of typical javascript arays)

  heapq.push(42);
  heapq.push("kitten");

  The push method returns the new number of elements of the queue.

  You can push anything you'd like onto the queue, so long as your
  comparator function is capable of handling it. The default 
  comparator is really stupid so it won't be able to handle anything
  other than an number by default.

  You can preview the smallest item by using peek.

  heapq.push(-9999)
  heapq.peek() ==> -9999

  The useful complement to to the push method is the pop method, 
  which returns the smallest item and then removes it from the
  queue.

  heapq.push(1)
  heapq.push(2)
  heapq.push(3)
  heapq.pop() ==> 1
  heapq.pop() ==> 2
  heapq.pop() ==> 3
*/

function HeapQueue(cmp){
	this.cmp = (cmp || function(a, b){ return a - b });
	this.length = 0;
	this.data = []
}

HeapQueue.prototype.peek = function(){
	return this.data[0]
}
HeapQueue.prototype.push = function(value){
	this.data.push(value);
	var pos = this.data.length - 1,
		parent, x;
	while(pos > 0){
		parent = (pos - 1) >>> 1;
		if(this.cmp(this.data[pos], this.data[parent]) < 0){
			x = this.data[parent]
			this.data[parent] = this.data[pos];
			this.data[pos] = x;
			pos = parent;
		}else break;
	}
	return ++this.length;
}
HeapQueue.prototype.pop = function(){
	var ret = this.data[0],
		last_val = this.data.pop();
	this.length--;
	if(this.data.length > 0){
		this.data[0] = last_val;
		var pos = 0,
			last = this.data.length - 1,
			left, right, minIndex, x;
		while(1){
			left = (pos << 1) + 1;
			right = left + 1;
			minIndex = pos;
			if(left <= last && this.cmp(this.data[left], this.data[minIndex]) < 0) minIndex = left;
			if(right <= last && this.cmp(this.data[right], this.data[minIndex]) < 0) minIndex = right;
			if(minIndex !== pos){
				x = this.data[minIndex]
				this.data[minIndex] = this.data[pos]
				this.data[pos] = x;
				pos = minIndex
			}else break;
		}
	}
	return ret
}

function UnionFind(count) {
  this.roots = new Array(count);
  this.ranks = new Array(count);
  
  for(var i=0; i<count; ++i) {
    this.roots[i] = i;
    this.ranks[i] = 0;
  }
}

UnionFind.prototype.length = function() {
  return this.roots.length;
}

UnionFind.prototype.makeSet = function() {
  var n = this.roots.length;
  this.roots.push(n);
  this.ranks.push(0);
  return n;
}

UnionFind.prototype.find = function(x) {
  var roots = this.roots;
  while(roots[x] !== x) {
    var y = roots[x];
    roots[x] = roots[y];
    x = y;
  }
  return x;
}


UnionFind.prototype.link = function(x, y) {
  var xr = this.find(x)
    , yr = this.find(y);
  if(xr === yr) {
    return;
  }
  var ranks = this.ranks
    , roots = this.roots
    , xd    = ranks[xr]
    , yd    = ranks[yr];
  if(xd < yd) {
    roots[xr] = yr;
  } else if(yd < xd) {
    roots[yr] = xr;
  } else {
    roots[yr] = xr;
    ++ranks[xr];
  }
}


// function link(root, root2){
//   var root = node[i]
//   while(root.parent){
//     root = root.parent;
//   }
//   var root2 = node[j];
//   while(root2.parent){
//     root2 = root2.parent;
//   }
//   if(root2 != root){
//     if(root.rank > root2.rank){
//       root2.parent = root;
//     }else{
//       root.parent = root2;
//       if(root.rank == root2.rank){
//         root2.rank++  
//       }
//       root = root2;
//     }
//     var node2 = node[j];
//     while(node2.parent){
//       var temp = node2;
//       node2 = node2.parent;
//       temp.parent = root;
//     }
//     var node2 = node[i];
//     while(node2.parent){
//       var temp = node2;
//       node2 = node2.parent;
//       temp.parent = root;
//     }
//   }
// }





// this is a port of something from libccv which
// is a port of something from opencv which is 
// a port of an algorithm in some textbook from
// somewhere

// it has rough functional parity with ccv_array_group
// and cvSeqPartition and the union-find algorithm
// except rather than returning a list of list 
// indicies in case one is so inclined to construct
// a list, it actually just returns the list

// this is a quadratic algorithm as far as I'm aware
// which means that the is_equal function will be called
// n(n - 1) times where n is the length of your elements
// array. For things with large numbers of elements,
// this can become very slow.

// it might be wise because of this to inform the
// algorithm with some notion of geometry. i.e.
// "these elements are really really far apart
// so they probably don't have anything to do with
// each other so lets just kind of let them do
// their thing and have incestuous relations with
// people closer to them"

function equivalence_classes(elements, is_equal){
  var node = []
  for(var i = 0; i < elements.length; i++){
    node.push({
      parent: 0,
      element: elements[i],
      rank: 0
    })
  }
  for(var i = 0; i < node.length; i++){
    var root = node[i]
    while(root.parent){
      root = root.parent;
    }
    for(var j = 0; j < node.length; j++){
      if(i == j) continue;
      if(!is_equal(node[i].element, node[j].element)) continue;
      var root2 = node[j];
      while(root2.parent){
        root2 = root2.parent;
      }
      if(root2 != root){
        if(root.rank > root2.rank){
          root2.parent = root;
        }else{
          root.parent = root2;
          if(root.rank == root2.rank){
            root2.rank++  
          }
          root = root2;
        }
        var node2 = node[j];
        while(node2.parent){
          var temp = node2;
          node2 = node2.parent;
          temp.parent = root;
        }
        var node2 = node[i];
        while(node2.parent){
          var temp = node2;
          node2 = node2.parent;
          temp.parent = root;
        }
      }
    }
  }
  var index = 0;
  var clusters = [];
  for(var i = 0; i < node.length; i++){
    var j = -1;
    var node1 = node[i]
    while(node1.parent){
      node1 = node1.parent
    }
    if(node1.rank >= 0){
      node1.rank = ~index++;
    }
    j = ~node1.rank;

    if(clusters[j]){
      clusters[j].push(elements[i])
    }else{
      clusters[j] = [elements[i]]
    }
  }
  return clusters;
}

// https://github.com/harthur/color-convert
// https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs

function deltaE(labA, labB){
  var deltaL = labA[0] - labB[0];
  var deltaA = labA[1] - labB[1];
  var deltaB = labA[2] - labB[2];
  var c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
  var c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
  var deltaC = c1 - c2;

  var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);

  var sc = 1.0 + 0.045 * c1;
  var sh = 1.0 + 0.015 * c1;

  var deltaLKlsl = deltaL / (1.0);
  var deltaCkcsc = deltaC / (sc);
  var deltaHkhsh = deltaH / (sh);
  var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}

function lab2rgb(lab){
  var y = (lab[0] + 16) / 116,
      x = lab[1] / 500 + y,
      z = y - lab[2] / 200,
      r, g, b;

  x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16/116) / 7.787);
  y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16/116) / 7.787);
  z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16/116) / 7.787);

  r = x *  3.2406 + y * -1.5372 + z * -0.4986;
  g = x * -0.9689 + y *  1.8758 + z *  0.0415;
  b = x *  0.0557 + y * -0.2040 + z *  1.0570;

  r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1/2.4) - 0.055) : 12.92 * r;
  g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1/2.4) - 0.055) : 12.92 * g;
  b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1/2.4) - 0.055) : 12.92 * b;

  return [Math.max(0, Math.min(1, r)) * 255, 
          Math.max(0, Math.min(1, g)) * 255, 
          Math.max(0, Math.min(1, b)) * 255]
}


function rgb2lab(rgb){
  var r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255,
      x, y, z;

  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}


// var minl = Infinity, maxl = -Infinity;
// var mina = Infinity, maxa = -Infinity;
// var minb = Infinity, maxb = -Infinity;
// for(var r = 0; r < 256; r+=2){
//   for(var g = 0; g < 256; g+=2){
//     for(var b = 0; b < 256; b+=2){
//       var lab = rgb2lab([r,g,b])
//       minl = Math.min(minl, lab[0])
//       maxl = Math.max(maxl, lab[0])
//       mina = Math.min(mina, lab[1])
//       maxa = Math.max(maxa, lab[1])
//       minb = Math.min(minb, lab[2])
//       maxb = Math.max(maxb, lab[2])
//     }
//   }
// }
// if(typeof console == "undefined"){
if(typeof window == "undefined"){
	console = {
		timers: {},
		buffer: [],
		log: function(text){
			// console.log(text)
			console.buffer.push(['$log', text])
			// postMessage({ action: 'log', text: text})
		},
		time: function(str){
			console.timers[str] = Date.now()
		},
		timeEnd: function(str){
			if(str in console.timers){
				console.log(str + ': ' + (Date.now() - console.timers[str]) + 'ms')	
			}
		},
		groupCollapsed: function(name){
			// postMessage({ action: 'groupcol', name: name })
			console.buffer.push(['$start', name])
		},
		groupEnd: function(){
			console.buffer.push(['$end'])
		},
		beginBuffer: function(){

		},
		finishBuffer: function(){
			postMessage({ action: 'grouptask', logs: console.buffer })	
			console.buffer = []
		}
	}
}
function partial_swt(src, params){
	var width = src.width, height = src.height;
	
	var img_u8 = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	var img_dxdy = new jsfeat.matrix_t(width, height, jsfeat.S32C2_t);

	console.time("image processing")
	jsfeat.imgproc.grayscale(src.data, img_u8.data)
	// visualize_matrix(img_u8)
	jsfeat.imgproc.sobel_derivatives(img_u8, img_dxdy)
	jsfeat.imgproc.gaussian_blur(img_u8, img_u8, params.kernel_size, 0)
	jsfeat.imgproc.canny(img_u8, img_u8, params.low_thresh, params.high_thresh)

	console.timeEnd("image processing")

	function extract_regions(direction){
		console.groupCollapsed(direction == 1 ? 'light on dark' : 'dark on light')
		console.time('total region extraction')
		params.direction = direction;
		var result = raw_swt(img_u8, img_dxdy, params);
		var swt = result.swt, strokes = {};


		function wrap_contours(points){
			var size = points.length;
			var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
			var m10 = 0, m01 = 0, m11 = 0, m20 = 0, m02 = 0;
			var swtsum = 0, swtvar = 0, swts = [];
			var marksum = 0;
			var y_coords = []

			for(var i = 0; i < size; i++){
				var p = points[i];
				var x = p % width, y = Math.floor(p / width);
				x0 = Math.min(x0, x); y0 = Math.min(y0, y);
				x1 = Math.max(x1, x); y1 = Math.max(y1, y);

				y_coords.push(y)

				m10 += x; m01 += y;
				m11 += x * y;
				m20 += x * x; m02 += y * y;
				swtsum += swt.data[p];
				
				if(marker) marksum += marker.data[p];

				swts.push(swt.data[p]);
			}

			var aspect_ratio = Math.max(x1 - x0, y1 - y0) / Math.min(x1 - x0, y1 - y0)
			
			var mean = swtsum / size;
			
			for(var i = 0; i < size; i++){
				var p = points[i];
				swtvar += (swt.data[p] - mean) * (swt.data[p] - mean)
			}
			var xc = m10 / size, yc = m01 / size;
			var af = m20 / size - xc * xc;
			var bf = 2 * (m11 / size - xc * yc)
			var cf = m02 / size - yc * yc;
			var delta = Math.sqrt(bf * bf + (af - cf) * (af - cf));
			var ratio = Math.sqrt((af + cf + delta) / (af + cf - delta));
			ratio = Math.max(ratio, 1 / ratio)

			// if(ratio > params.aspect_ratio && !is_L) return;
			if(ratio > params.aspect_ratio) return;

			var median = swts.sort(function(a, b){return a - b})[Math.floor(swts.length / 2)]
			var std = Math.sqrt(swtvar / size);
			// if(std > mean * params.std_ratio) return;
			var area = (x1 - x0 + 1) * (y1 - y0 + 1)
			
			if(size / area < 0.1) return;


			var cy = y0 + (y1 - y0) / 2,
				cx = x0 + (x1 - x0) / 2;

			// if(x0 == 0 || y0 == 0 || y1 == height - 1 || x1 == width - 1) return;

			// x-axis border touching is okay because we dont define our 
			// clipping boundaries by them (that doesnt really make sense
			// but im about to go to bed) so like our little chunks are all
			// full width so things touching the edge arent artifacts

			if(y0 == 0 || y1 == height - 1) return;
			
			return {
				x0: x0,
				y0: y0,
				y1: y1,
				x1: x1,
				cx: cx,
				cy: cy,
				width: x1 - x0 + 1,
				height: y1 - y0 + 1,
				size: size,
				// color: dominant_color(colors, direction),
				// color: [sr/size, sg/size, sb/size],
				// color: domcolor,
				ratio: (x1 - x0) / (y1 - y0), 
				ratio2: ratio,
				std: std,
				mean: mean,
				medy: y_coords.sort(function(a, b){ return a - b })[Math.floor(y_coords.length / 2)] - cy,
				area: area,
				contours: points,
				markweight: marksum / size,
				thickness: median
			}
		}


		function wrap_lines(letters){
			if(letters.length == 0) return null;

			letters = letters.sort(function(a, b){ return a.cx - b.cx })

			// var sumx = 0, sumx2 = 0, sumxy = 0, sumy = 0, sumy2 = 0;
			var size = 0;

			var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0, hs = 0;
			for(var i = 0; i < letters.length; i++){
				var letter = letters[i];
				x0 = Math.min(x0, letter.x0); y0 = Math.min(y0, letter.y0);
				x1 = Math.max(x1, letter.x1); y1 = Math.max(y1, letter.y1);
				size += letter.size
				hs += letter.height
				// sumx += letter.cx; sumy += letter.cy;
				// sumx2 += letter.cx * letter.cx; sumy2 += letter.cy * letter.cy;
				// sumxy += letter.cx * letter.cy;
			}

			// var n = letters.length;
			// var dy = (n * sumxy - sumx * sumy);
			// var dx = (n * sumx2 - sumx * sumx);
			// var yi = (sumy * sumx2 - sumx * sumxy) / (n * sumx2 - sumx * sumx);
			// var r = (sumxy - sumx * sumy / n) / Math.sqrt((sumx2 - sumx*sumx/n) * (sumy2 - sumy*sumy/n));


			var slopes = []
			// This is an implementation of a Theil-Sen estimator
			// it's like actually really simple, it's just the median
			// of the slopes between every existing pair of points
			for(var i = 0; i < letters.length; i++){
				var li = letters[i];
				for(var j = 0; j < i; j++){
					var lj = letters[j];
					slopes.push((li.cy - lj.cy) / (li.cx - lj.cx))
				}
			}
			var dydx = slopes.sort(function(a, b){ return a - b })[Math.floor(slopes.length/2)]


			var cx = x0 / 2 + x1 / 2,
				cy = y0 / 2 + y1 / 2;

			var yr0 = Infinity, yr1 = -Infinity, sh = 0, st = 0;
			for(var i = 0; i < letters.length; i++){
				var letter = letters[i];
				var y_pred = (letter.cx - cx) * dydx + cy
				yr0 = Math.min(yr0, letter.y0 - y_pred)
				yr1 = Math.max(yr1, letter.y1 - y_pred)
				sh += letter.height
				st += letter.thickness
			}

			var lettersize = letters.map(function(e){
				return e.size / e.width
			}).sort(function(a, b){return a - b})[Math.floor(letters.length / 2)]



			// console.log('letter '+lettersize)

			// approximate the x-height of some line of text
			// as the height of the smallest character whose
			// height is larger than half the average character
			// height
			var xheight = letters.map(function(e){
				return e.height
			}).filter(function(e){
				// return e > (yr1 - yr0) / 3
				return e <= (hs / letters.length)
			}).sort(function(a, b){
				return a - b
			}).slice(-1)[0]

			// var weight = letters.map(function(e){
			// 	return e.thickness
			// }).sort(function(a, b){return a - b})[Math.floor(letters.length / 2)] / xheight

			// var weights = letters.filter(function(e){
			// 	return e.height <= (hs / letters.length)
			// }).map(function(e){
			// 	return e.size / e.width / e.height
			// }).sort(function(a, b){return a - b});

			// var weight = weights[Math.floor(weights.length / 2)]

			return {
				letters: letters,
				lettercount: letters.length,
				lettersize: lettersize,
				// weight: weight,
				size: size,
				lineheight: yr1 - yr0,
				xheight: xheight,
				avgheight: sh / letters.length,
				direction: direction,
				// angle: Math.atan2(dy, dx),
				angle: Math.atan(dydx),
				thickness: st / letters.length,
				// r2: r * r,
				x0: x0,
				y0: y0,
				y1: y1,
				x1: x1,
				cx: cx,
				cy: cy,
				width: x1 - x0 + 1,
				height: y1 - y0 + 1,
				area: (x1 - x0) * (y1 - y0)
			}
		}


		console.time('connected swt')
		var contours = connected_swt(swt, params)
		console.timeEnd('connected swt')

		params.marker = swt

		console.time("wrap contours 1")
		var letters = contours
			.map(wrap_contours)
			.filter(function(e){
				if(!e) return false;
				if(e.std > e.mean * params.std_ratio) return false;
				// if(e.size < 10) return false;
				return true
			})
		console.timeEnd("wrap contours 1")

		letters = exclude_occlusions(letters, width, height, params)

		if(params.debug) visualize_matrix(swt, letters);
		// letters = letters.filter(function(a){
		// 	return !letters.some(function(b){
		// 		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
		// 			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		// 		return width > 0 && height > 0
		// 	})
		// })


		// letters = exclude_occlusions(letters, width, height, params)

		var lines = find_lines(letters, params)
			.filter(function(e){return e.length > 1})
			.map(wrap_lines)
			.filter(function(e){
				return e.lettercount > 3 || (e.lettercount > 2 && Math.abs(e.angle) < 0.1)
			});
		
		if(params.debug) visualize_matrix(swt, lines);

		// params.marker = swt
		if(typeof window == 'object' && params.debug){
			blargh = visualize_matrix(swt, letters);
			lines.forEach(function(line){
				blargh.beginPath()
				var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
				blargh.strokeStyle = colors[Math.floor(colors.length * Math.random())]
				blargh.lineWidth = 3

				line.letters
					.sort(function(a, b){ return a.cx - b.cx })
					.forEach(function(letter){
						blargh.lineTo(letter.cx, letter.cy)
					})

				blargh.stroke()
			})
		}

		var marker = filter_regions(lines, src)
		
		console.time("flood contours")
		var letters = connected_priority(marker, params)
			.map(wrap_contours)
			.filter(function(e){
				return e
			})
		console.timeEnd("flood contours")
		
		letters = exclude_occlusions(letters, width, height, params)


		

		if(typeof window == 'object' && params.debug){
			blargh = visualize_matrix(marker, letters);
			// lines.forEach(function(line){
			// 	blargh.beginPath()
			// 	var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
			// 	blargh.strokeStyle = colors[Math.floor(colors.length * Math.random())]
			// 	blargh.lineWidth = 3

			// 	line.letters
			// 		.sort(function(a, b){ return a.cx - b.cx })
			// 		.forEach(function(letter){
			// 			blargh.lineTo(letter.cx, letter.cy)
			// 		})

			// 	blargh.stroke()
			// })
		}
		
		var lines = find_lines(letters, params)
			.filter(function(e){return e.length > 1})
			.map(wrap_lines)



		// console.log(lines)
		// merge the adjacent lines
		for(var i = 0; i < 2; i++){ // do it twice because sometimes it misses something on the first go
			lines = equivalence_classes(lines, function(r_bb, l_bb){
				var y_overlap = Math.min(r_bb.y1, l_bb.y1) - Math.max(r_bb.y0, l_bb.y0);
				if(y_overlap <= 0) return false;
				var frac_overlap = y_overlap / Math.min(r_bb.height, l_bb.height)
				if(frac_overlap < 0.8) return false;
				var x_dist = Math.max(r_bb.x0, l_bb.x0) - Math.min(r_bb.x1, l_bb.x1)
				if(x_dist < 0) return false;
				if(x_dist > 0.2 * Math.max(r_bb.width, l_bb.width)) return false;

				if(x_dist > 3 * Math.max(r_bb.height, l_bb.height)) return false;

				var max_ang = 0.2; // this merger breaks down with too much angle
				if(Math.abs(r_bb.angle) > max_ang || Math.abs(r_bb.angle) > max_ang) return false;
				
				if(Math.max(r_bb.height, l_bb.height) / Math.min(r_bb.height, l_bb.height) > 1.4) return false;

				// if(Math.abs(r_bb.lettersize - l_bb.lettersize) / Math.min(r_bb.lettersize, l_bb.lettersize) > params.lettersize) return false;

				return true
			}).map(function(cluster){
				if(cluster.length == 1) return cluster[0];
				return wrap_lines([].concat.apply([], cluster.map(function(e){return e.letters})))
			})
		}
		


		console.time("split lines")
		// this is a weird thing that does a quasi-dynamic programmingish
		// thing in order to figure out vertical lines and then use that
		// to split up lines 
		
		lines = [].concat.apply([], split_lines(lines, swt).map(function(groups){
			return (groups.length == 1) ? groups : groups.map(wrap_lines)
		})).filter(function(e){
			return e.lettercount > 1
		})
		
		console.timeEnd("split lines")


		function mean(arr){
			for(var s = 0, i = 0; i < arr.length; i++) s += arr[i];
			return s / arr.length;
		}

		function stdev(arr){
			for(var s = 0, ss = 0, i = 0; i < arr.length; i++){
				s += arr[i]
				ss += arr[i] * arr[i]
			}
			return Math.sqrt((ss - s * s / arr.length) / (arr.length - 1))
		}

		lines = lines.map(function(line){
			if(line.letters.length < 7) return line;

			var heights = line.letters.slice(1, -1).map(function(e){ return e.height })
			var avg = mean(heights)

			// this might be a bad idea
			var heights = line.letters.slice(1, -1)
				.map(function(e){ return e.height })
				.filter(function(e){ return e > avg })
			var avg = mean(heights)

			var std = Math.max(1, stdev(heights))

			if(avg < 10) return line;

			// if(first.)
			var letters = line.letters;
			if((letters[0].height - avg) / std > 3){
				letters = letters.slice(1)
			}

			if((letters[letters.length - 1].height - avg) / std > 3){
				letters = letters.slice(0, -1)
			}

			// if(Math.abs(line.angle) - Math.abs(measure_angle(line.letters.slice(1))) > 0.01){
			// 	letters = letters.slice(1)
			// }

			if(letters.length < line.letters.length){
				return wrap_lines(letters)
			}


			return line;



			// return wrap_lines(line.letters.filter(function(e){

			// 	cdf(e.height, mean, std * std)

			// 	console.log('z score' + ((e.height - mean) / std))
			// 	console.log('std ' + std)

			// 	// if(std > 3 && ((e.height - mean) / std) > 0.7){
			// 	// 	return false
			// 	// }
			// 	return true
			// }))
			// return line
		}).filter(function(e){ return e })

		// if(params.debug) visualize_matrix(marker, lines);

		lines = lines.filter(function(line){
			// if(line.letters.length < params.letter_thresh) return false;
			// if(line.width <= line.height * params.elongate_ratio) return false;
			if(Math.abs(line.angle / line.lettercount) > 0.07) return false;
			return true
		})

		if(typeof window == 'object' && params.debug){
			blargh = visualize_matrix(marker, lines);
			lines.forEach(function(line){
				blargh.beginPath()
				var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
				blargh.strokeStyle = colors[Math.floor(colors.length * Math.random())]
				blargh.lineWidth = 3

				line.letters
					.sort(function(a, b){ return a.cx - b.cx })
					.forEach(function(letter){
						blargh.lineTo(letter.cx, letter.cy)
					})

				blargh.stroke()
			})
		}
		
		if(params.debug) visualize_matrix(marker, lines);

		console.timeEnd('total region extraction')
		console.groupEnd()

		// letter shape is more useful than like the alternative
		lines.forEach(function(line){
			line.letters.forEach(function(letter){
				var contour = [];
				for(var i = 0; i < letter.contours.length; i++){
					var p = letter.contours[i]
					var x = p % width, y = Math.floor(p / width);
					contour.push((x - letter.x0) + (y - letter.y0) * (letter.x1 - letter.x0 + 1))
				}
				delete letter.contours;
				letter.shape = contour;
			})
		})
		return lines;

	}

	var lines = extract_regions(-1).concat(extract_regions(1));

	lines.sort(function(a, b){ return a.cy - b.cy }) // lets sort the lines top to bottom

	return lines;
}

// canny & sobel dx/dy
function raw_swt(img_canny, img_dxdy, params){
	var max_stroke = params.max_stroke, // maximum stroke width
		direction = params.direction,
		width = img_canny.cols,
		height = img_canny.rows;

	// nonzero Math.min function, if a is zero, returns b, otherwise minimizes
	function nzmin(a, b){
		if(a === 0) return b;
		if(a < b) return a;
		return b;
	}
	
	var strokes = [];
	var swt = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	
	console.time("first pass")
	// first pass of stroke width transform 
	for(var i = 0; i < width * height; i++){
		if(img_canny.data[i] != 0xff) continue; // only apply on edge pixels

		var itheta = Math.atan2(img_dxdy.data[(i<<1) + 1], img_dxdy.data[i<<1]); // calculate the image gradient at this point by sobel
		var ray = [i];
		var step = 1;
		
		var ix = i % width, iy = Math.floor(i / width);
		while(step < max_stroke){
			// extrapolate the ray outwards depending on search direction
			// libccv is particularly clever in that it uses 
			// bresenham's line drawing algorithm to pick out
			// the points along the line and also checks 
			// neighboring pixels for corners

			var jx = Math.round(ix + Math.cos(itheta) * direction * step);
			var jy = Math.round(iy + Math.sin(itheta) * direction * step);
			step++;
			if(jx < 0 || jy < 0 || jx > width || jy > height) break;
			var j = jy * width + jx;
			ray.push(j)
			if(img_canny.data[j] != 0xff) continue;
			// calculate theta for this ray since we've reached the other side
			var jtheta = Math.atan2(img_dxdy.data[(j<<1) + 1], img_dxdy.data[j<<1]); 
			
			if(Math.abs(Math.abs(itheta - jtheta) - Math.PI) < Math.PI / 2){ // check if theta reflects the starting angle approximately
				strokes.push(i)
				var sw = Math.sqrt((jx - ix) * (jx - ix) + (jy - iy) * (jy - iy)) // derive the stroke width
				for(var k = 0; k < ray.length; k++){ // iterate rays and set points along ray to minimum stroke width
					swt.data[ray[k]] = nzmin(swt.data[ray[k]], sw) // use nzmin because it's initially all 0's
				}
			}
			break;
		}
	}
	console.timeEnd("first pass")
	console.time("refinement pass")

	// second pass, refines swt values as median
	for(var k = 0; k < strokes.length; k++){
		var i = strokes[k];
		var itheta = Math.atan2(img_dxdy.data[(i<<1) + 1], img_dxdy.data[i<<1]);
		var ray = [];
		var widths = []
		var step = 1;

		var ix = i % width, iy = Math.floor(i / width);
		while(step < max_stroke){
			var jx = Math.round(ix + Math.cos(itheta) * direction * step);
			var jy = Math.round(iy + Math.sin(itheta) * direction * step);
			step++;
			var j = jy * width + jx;
			// record position of the ray and the stroke width there
			widths.push(swt.data[j])
			ray.push(j)			
			// stop when the ray is terminated
			if(img_canny.data[j] == 0xff) break;
		}
		var median = widths.sort(function(a, b){return a - b})[Math.floor(widths.length / 2)];
		// set the high values to the median so that corners are nice
		for(var j = 0; j < ray.length; j++){
			swt.data[ray[j]] = nzmin(swt.data[ray[j]], median)
		}
		// swt.data[ray[0]] = 0
		// swt.data[ray[ray.length - 1]] = 0
	}

	console.timeEnd("refinement pass")
	
	return {
		swt: swt,
		strokes: strokes
	}
}



function coarse_lines(letters, params){
	console.time("form pairs")
	
	// note that in this instance, it might not actually be necessary
	// to use a heap queue because it turns out that we basically compute
	// a list of elements and then process them, and we dont stick things
	// back onto the queue after processing them so we could probably just
	// get by with making an array and sorting it

	// also it might not be necessary to use the find union algorithm, instead
	// we could just keep track of each element's group number and also keep track 
	// of all the groups because at each merge decision we need to access a list
	// of the elements in the relevant groups anyway, so in this case the 
	// performance benefit of the asymptotically inverse ackermann are probably
	// all but lost

	// in addition all those chain merging weights, there should also be something
	// which prioritizes merging lines which are of similar angles rather than
	// introducing a turn.

	// var pair_queue = new HeapQueue(function(a, b){ return a.dist - b.dist })
	var pair_queue = []

	// for(var i = 0; i < letters.length; i++) letters[i].index = i;

	for(var i = 0; i < letters.length; i++){
		var li = letters[i];
		var min_dist = Infinity,
			min_j = null;
		for(var j = 0; j < letters.length; j++){
			if(j == i) continue;

			var lj = letters[j];

			var ratio = li.thickness / lj.thickness;
			if(ratio > params.thickness_ratio || ratio < 1 / params.thickness_ratio) continue;

			if(Math.max(li.height, lj.height) / Math.min(li.height, lj.height) > params.height_ratio) continue;

			if(Math.max(li.width, lj.width) / Math.min(li.width, lj.width) > 10) continue;

			if(li.x0 < lj.x0 && li.x1 > lj.x1) continue; // one is entirely consumed by another
			if(lj.x0 < li.x0 && lj.x1 > li.x1) continue; // one is entirely consumed by another

			var right = (li.x1 > lj.x1) ? li : lj,
				left = (li.x1 > lj.x1) ? lj : li;

			var w = Math.max(0, Math.max(right.x0, left.x0) - Math.min(right.x1, left.x1)),
				h = Math.max(0, Math.max(right.y0, left.y0) - Math.min(right.y1, left.y1));

			// if(w > 2 * Math.max(Math.min(left.height, left.width), Math.min(right.height, right.width))) continue;
			// if(h > 10) continue; // 0 would be safer but 10 allows super extreme angles
			var dy = right.cy - left.cy, 
				dx = right.cx - left.cx;

			var slope = dy / dx
			if(Math.abs(slope) > 1) continue; // cap the max slope


			var dist = w * w + h * h;
			if(dist < min_dist){
				min_dist = dist;
				min_j = lj
			}
		}
		// console.log(min_j, li, dist)
		if(min_j){
			var lj = min_j;
			var right = (li.x1 > lj.x1) ? li : lj,
				left = (li.x1 > lj.x1) ? lj : li;
			pair_queue.push({
				left: left,
				right: right,
				dist: min_dist
			})
		}

	}
	console.log("got shit", pair_queue)


	pair_queue.sort(function(a, b){
		return a.dist - b.dist
	})
	console.timeEnd("form pairs")
	console.time("create lines")

	var groups = []
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i]
		letter.group = groups.length
		groups.push({
			members: [letter]
		})
	}

	var derp = visualize_matrix(params.marker, letters)
	for(var i = 0; i < pair_queue.length; i++){
		var pair = pair_queue[i]
		derp.beginPath()
		var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
		derp.strokeStyle = colors[Math.floor(colors.length * Math.random())]
		derp.lineWidth = 1
		// if(pair.left.x1 > 100) continue; 
		// if(pair.right.x1 > 100) continue; 
		// derp.moveTo(pair.left.x0 + pair.left.width * Math.random(), pair.left.y0 + Math.random() * pair.left.height)

		// derp.lineTo(pair.right.x0 + pair.right.width * Math.random(), pair.right.y0 + Math.random() * pair.right.height)
		derp.moveTo(pair.left.cx, pair.left.cy)
		derp.lineTo(pair.right.cx, pair.right.cy)
		derp.stroke()

	}

	var total_length = pair_queue.length;

	while(pair_queue.length){
		var pair = pair_queue.shift()
		
		var left_group = pair.left.group,
			right_group = pair.right.group;
			
		if(left_group == right_group) continue;

		var lca = groups[left_group].members,
			rca = groups[right_group].members;
		


		// if(!(lca[0] == pair.left || lca[lca.length - 1] == pair.left)) continue;
		// if(!(rca[0] == pair.right || rca[rca.length - 1] == pair.right)) continue;

		// if(!( && (rca[0] == pair.right || rca[rca.length - 1] == pair.right))) continue; 

		var merged = lca.concat(rca).sort(function(a, b){ return a.x1 - b.x1 })

		for(var i = 0; i < lca.length; i++)
			lca[i].group = right_group;

		groups[right_group].members = merged		
		// groups[right_group].slope = dy / dx;

		// var merp = visualize_matrix(params.marker)
		// groups.filter(function(e){
		// 	return e
		// }).map(function(e){
		// 	merp.beginPath()
		// 	var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
		// 	merp.strokeStyle = colors[Math.floor(colors.length * Math.random())]
		// 	merp.lineWidth = 3
		// 	e.members.forEach(function(letter){
		// 		merp.lineTo(letter.cx, letter.cy)
		// 		if(e.members.length > 1){
		// 			merp.strokeRect(letter.x0, letter.y0, letter.width, letter.height)	
		// 		}
				
		// 	})
		// 	merp.stroke()
		// })

		groups[left_group] = null
	}

	console.timeEnd("create lines")


	return groups.filter(function(e){
		return e
	}).map(function(e){
		return e.members
	})


}



function find_lines(letters, params){
	console.time("form pairs")
	
	// note that in this instance, it might not actually be necessary
	// to use a heap queue because it turns out that we basically compute
	// a list of elements and then process them, and we dont stick things
	// back onto the queue after processing them so we could probably just
	// get by with making an array and sorting it

	// also it might not be necessary to use the find union algorithm, instead
	// we could just keep track of each element's group number and also keep track 
	// of all the groups because at each merge decision we need to access a list
	// of the elements in the relevant groups anyway, so in this case the 
	// performance benefit of the asymptotically inverse ackermann are probably
	// all but lost

	// in addition all those chain merging weights, there should also be something
	// which prioritizes merging lines which are of similar angles rather than
	// introducing a turn.

	// var pair_queue = new HeapQueue(function(a, b){ return a.dist - b.dist })
	var pair_queue = []

	// for(var i = 0; i < letters.length; i++) letters[i].index = i;

	for(var i = 0; i < letters.length; i++){
		var li = letters[i];
		for(var j = i + 1; j < letters.length; j++){
			var lj = letters[j];

			var ratio = li.thickness / lj.thickness;
			if(ratio > params.thickness_ratio || ratio < 1 / params.thickness_ratio) continue;

			if(Math.max(li.height, lj.height) / Math.min(li.height, lj.height) > params.height_ratio) continue;

			if(Math.max(li.width, lj.width) / Math.min(li.width, lj.width) > 10) continue;

			if(li.x0 < lj.x0 && li.x1 > lj.x1) continue; // one is entirely consumed by another
			if(lj.x0 < li.x0 && lj.x1 > li.x1) continue; // one is entirely consumed by another

			var right = (li.x1 > lj.x1) ? li : lj,
				left = (li.x1 > lj.x1) ? lj : li;

			// var woverlap = Math.max(0, Math.min(right.x1, left.x1) - Math.max(right.x0, left.x0)),
			// 	hoverlap = Math.max(0, Math.min(right.y1, left.y1) - Math.max(right.y0, left.y0));

			var w = Math.max(0, Math.max(right.x0, left.x0) - Math.min(right.x1, left.x1)),
				h = Math.max(0, Math.max(right.y0, left.y0) - Math.min(right.y1, left.y1));


			// var h_dist = Math.max(0, right.x0 - left.x1)
			if(w > 2 * Math.max(Math.min(left.height, left.width), Math.min(right.height, right.width))) continue;

			// if(w > 2 * Math.max(Math.sqrt(left.width * left.height), Math.sqrt(right.width * right.height))) continue;
			// if(w > 2 * Math.min(Math.max(left.height, left.width), Math.max(right.height, right.width))) continue;

			if(h > 10) continue; // 0 would be safer but 10 allows super extreme angles

			// if(Math.max(li.markweight, lj.markweight)/Math.min(li.markweight, lj.markweight) > 4) continue;

			var dy = right.cy - left.cy, 
				dx = right.cx - left.cx;

			var slope = dy / dx

			if(Math.abs(slope) > 1) continue; // cap the max slope


			// if(Math.max(right.contours.length, left.contours.length) / Math.min(right.contours.length, left.contours.length) > 3) continue; 

			// var h_align = Math.min(Math.abs(left.y0 - right.y0), Math.abs(left.y1 - right.y1), Math.abs(left.cy - right.cy))

			pair_queue.push({
				left: left,
				right: right,
				// dist: w
				// this is meant to bias things toward flatness
				// but this isn't necessarily good because it also flattens
				// things that aren't flat
				// dist: w * w + h
				// dist: Math.sqrt(10 * dy * dy + Math.pow(dx + w, 2)) // euclidean distance ftw
				// dist: Math.sqrt(10 * dy * dy + dx * dx) // euclidean distance ftw
				dist: Math.sqrt(20 * Math.pow(dy + h, 2) + Math.pow(dx + w, 2)) // new thingy

				// dist: Math.sqrt(10 * dy * dy + w * w) // frankendistance
				// this minimizes the x distance and also puts a weight on the y distance
			})
		}
	}


	pair_queue.sort(function(a, b){
		return a.dist - b.dist
	})
	console.timeEnd("form pairs")
	console.time("create lines")

	var groups = []
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i]
		letter.group = groups.length
		groups.push({
			members: [letter]
		})
	}

	// var derp = visualize_matrix(params.marker, letters)
	// for(var i = 0; i < pair_queue.length; i++){
	// 	var pair = pair_queue[i]
	// 	derp.beginPath()
	// 	var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
	// 	derp.strokeStyle = colors[Math.floor(colors.length * Math.random())]
	// 	derp.lineWidth = 1
	// 	if(pair.left.x1 > 100) continue; 
	// 	if(pair.right.x1 > 100) continue; 
	// 	derp.moveTo(pair.left.x0 + pair.left.width * Math.random(), pair.left.y0 + Math.random() * pair.left.height)
	// 	derp.lineTo(pair.right.x0 + pair.right.width * Math.random(), pair.right.y0 + Math.random() * pair.right.height)
	// 	derp.stroke()

	// }

	// var forest = new UnionFind(letters.length)

	// this is like the sum of the absolute value of the second derivative
	// of the center of each letter sorted by x, if two runs of letters
	// get merged together and overlap, then it'll register as a pretty 
	// big ziggometric spike which means that we can exclude those
	// and the second derivative means 
	function zigometer(set){	
		var v_overlap = 2; // this is the allowable vertical extent

		if(set.length < 3) return 0; // cant calculate discrete 2nd deriv of 2 points
		set.sort(function(a, b){ return a.x1 - b.x1 }) // im debating whether this is a better metric than cx
		var last = set[0], lastdy, sigddy = 0;
		for(var i = 1; i < set.length; i++){
			// var dy = set[i].cy - last.cy;
			// var dy = Math.max(0, Math.abs(set[i].cy - last.cy) - Math.max(set[i].height, last.height));
			var dy =  Math.max(v_overlap, Math.max(last.y0, set[i].y0) - Math.min(last.y1, set[i].y1)) - v_overlap
			if(i > 1) sigddy += Math.abs(dy - lastdy);
			lastdy = dy
			last = set[i]
		}
		return 1000 * sigddy
	}

	function zigometer_strict(set){	
		var v_overlap = 2; // this is the allowable vertical extent

		if(set.length < 3) return 0; // cant calculate discrete 2nd deriv of 2 points
		set.sort(function(a, b){ return a.x1 - b.x1 }) // im debating whether this is a better metric than cx
		var last = set[0], lastdy, sigddy = 0;
		for(var i = 1; i < set.length; i++){
			var dy = set[i].cy - last.cy;
			// var dy = Math.max(0, Math.abs(set[i].cy - last.cy) - Math.max(set[i].height, last.height));
			// var dy =  Math.max(v_overlap, Math.max(last.y0, set[i].y0) - Math.min(last.y1, set[i].y1)) - v_overlap
			if(i > 1) sigddy += Math.abs(dy - lastdy);
			lastdy = dy
			last = set[i]
		}
		return 1000 * sigddy
	}
	function measure_angle(letters){
		if(letters.length == 1) return 0;

		var slopes = []
		for(var i = 0; i < letters.length; i++){
			var li = letters[i];
			for(var j = 0; j < i; j++){
				var lj = letters[j];
				slopes.push((li.cy - lj.cy) / (li.cx - lj.cx))
			}
		}
		return Math.atan(slopes.sort(function(a, b){ return a - b })[Math.floor(slopes.length/2)])
	}
	// function measure_angle(letters){
	// 	if(letters.length == 1) return 0;

	// 	var sumx = 0, sumx2 = 0, sumxy = 0, sumy = 0, sumy2 = 0;
	// 	for(var i = 0; i < letters.length; i++){
	// 		var letter = letters[i];
	// 		sumx += letter.cx; sumy += letter.cy;
	// 		sumx2 += letter.cx * letter.cx; sumy2 += letter.cy * letter.cy;
	// 		sumxy += letter.cx * letter.cy;
	// 	}
	// 	var n = letters.length;
	// 	var dy = (n * sumxy - sumx * sumy);
	// 	var dx = (n * sumx2 - sumx * sumx);
	// 	var yi = (sumy * sumx2 - sumx * sumxy) / (n * sumx2 - sumx * sumx);
	// 	var r = (sumxy - sumx * sumy / n) / Math.sqrt((sumx2 - sumx*sumx/n) * (sumy2 - sumy*sumy/n));
	// 	return Math.atan2(dy, dx)
	// }
	function bounding_box(set){
		var x0 = set[0].x0, y0 = set[0].y0,
			x1 = set[0].x1, y1 = set[0].y1;
		for(var i = 1; i < set.length; i++){
			x0 = Math.min(x0, set[i].x0)
			y0 = Math.min(y0, set[i].y0)
			x1 = Math.max(x1, set[i].x1)
			y1 = Math.max(y1, set[i].y1)
		}
		return {x0: x0, y0: y0, x1: x1, y1: y1, width: x1 - x0, height: y1 - y0}
	}
	function intersects(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		var min_area = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))
		return (width > 0 && height > 0) && (width * height) > 0.3 * min_area
	}
	var total_length = pair_queue.length;

	while(pair_queue.length){
		var pair = pair_queue.shift()
		
		var left_group = pair.left.group,
			right_group = pair.right.group;
			
		if(left_group == right_group) continue;

		var lca = groups[left_group].members,
			rca = groups[right_group].members;
		


		// if(!(lca[0] == pair.left || lca[lca.length - 1] == pair.left)) continue;
		// if(!(rca[0] == pair.right || rca[rca.length - 1] == pair.right)) continue;

		// if(!( && (rca[0] == pair.right || rca[rca.length - 1] == pair.right))) continue; 
		var langle = measure_angle(lca),
			rangle = measure_angle(rca);

		var merged = lca.concat(rca).sort(function(a, b){ return a.x1 - b.x1 })

		if(lca.length > 1 || rca.length > 1){
			var zigtotes = zigometer(merged) / (lca.length + rca.length);
			var angtotes = measure_angle(merged)
			
			if(Math.abs(angtotes) > 0.1 + Math.abs(langle) + Math.abs(rangle)) continue;

			if(zigtotes > 0) continue;	

			var r_bb = bounding_box(rca),
				l_bb = bounding_box(lca);

			if(intersects(r_bb, l_bb)) continue;

			// var dy = Math.abs((r_bb.y0 / 2 + r_bb.y1 / 2) - (l_bb.y0 / 2 + l_bb.y1 / 2))

			// var y_overlap = Math.min(r_bb.y1, l_bb.y1) - Math.max(r_bb.y0, l_bb.y0);
			// if(y_overlap < 0) continue;

			// var frac_overlap = y_overlap / Math.min(l_bb.y1 - l_bb.y0, r_bb.y1 - r_bb.y0)
			
			// if(frac_overlap < 1 - 0.1 / Math.max(lca.length, rca.length)) continue;

			// var l_dim = Math.max.apply(Math, lca.map(function(e){ return e.contours.length }))
			// var r_dim = Math.max.apply(Math, rca.map(function(e){ return e.contours.length }))

			// var ratio = Math.max(r_dim, l_dim) / Math.min(r_dim, l_dim)
			// if(ratio > 1 + 10 / Math.max(lca.length, rca.length)) continue;


			var l_height = Math.max.apply(Math, lca.map(function(e){ return e.height }))
			var r_height = Math.max.apply(Math, rca.map(function(e){ return e.height }))
			// if(dy / Math.max(l_height, r_height) > 0.1){
			var ratio = Math.max(r_height, l_height) / Math.min(r_height, l_height)

			if(ratio > 1.5 + 10 / Math.max(lca.length, rca.length)) continue;

			// var l_width = Math.max.apply(Math, lca.map(function(e){ return e.width }))
			// var r_width = Math.max.apply(Math, rca.map(function(e){ return e.width }))

			// var ratio = Math.max(r_width, l_width) / Math.min(r_width, l_width)

			// if(ratio > 1.5 + 20 / Math.max(lca.length, rca.length)) continue;

	
			// }
			

		}
		// var sumx = 0, sumx2 = 0, sumxy = 0, sumy = 0, sumy2 = 0;

		// for(var i = 0; i < merged.length; i++){
		// 	var letter = merged[i];
		// 	sumx += letter.cx; sumy += letter.cy;
		// 	sumx2 += letter.cx * letter.cx; sumy2 += letter.cy * letter.cy;
		// 	sumxy += letter.cx * letter.cy;
		// }

		// var n = merged.length;
		// var dy = (n * sumxy - sumx * sumy);
		// var dx = (n * sumx2 - sumx * sumx);
		// var yi = (sumy * sumx2 - sumx * sumxy) / (n * sumx2 - sumx * sumx);
		// var r = (sumxy - sumx * sumy / n) / Math.sqrt((sumx2 - sumx*sumx/n) * (sumy2 - sumy*sumy/n));

		// console.log(dy/dx, groups[left_group].slope, groups[right_group].slope)
		// if(Math.abs(dy/dx) - 0.01 > 2 * Math.max(Math.abs(groups[right_group].slope), Math.abs(groups[left_group].slope))) continue;

		for(var i = 0; i < lca.length; i++)
			lca[i].group = right_group;

		groups[right_group].members = merged		
		// groups[right_group].slope = dy / dx;

		// var merp = visualize_matrix(params.marker)
		// groups.filter(function(e){
		// 	return e
		// }).map(function(e){
		// 	merp.beginPath()
		// 	var colors = ['green', 'blue', 'red', 'purple', 'orange', 'yellow']
		// 	merp.strokeStyle = colors[Math.floor(colors.length * Math.random())]
		// 	merp.lineWidth = 3
		// 	e.members.forEach(function(letter){
		// 		merp.lineTo(letter.cx, letter.cy)
		// 		if(e.members.length > 1){
		// 			merp.strokeRect(letter.x0, letter.y0, letter.width, letter.height)	
		// 		}
				
		// 	})
		// 	merp.stroke()
		// })

		groups[left_group] = null
	}

	console.timeEnd("create lines")


	return groups.filter(function(e){
		return e
	}).map(function(e){
		return e.members
	})


}



function filter_regions(regions, src){
	// what is the radius of the structuring element for our morphological dilation
	var dilrad = 4;
	// how many pixels to include outside the region in our color filtering
	var xpad = 30,
		ypad = 20;

	var width = src.width,
		height = src.height;

	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	var dilation = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t);
	

	console.time('morphological dilation')

	for(var a = regions.length - 1; a >= 0; a--){
		for(var b = regions[a].letters.length - 1; b >= 0; b--){
			var c = regions[a].letters[b].contours;
			for(var i = c.length - 1; i >= 0; i--){
				for(var dx = -dilrad; dx <= dilrad; dx++){
					for(var dy = -dilrad; dy <= dilrad; dy++){
						dilation.data[c[i] + dx + dy * width] = 1
					}
				}
			}
		}
	}
	// set thing in there to 2 so that we know which ones are inside
	for(var a = regions.length - 1; a >= 0; a--){
		for(var b = regions[a].letters.length - 1; b >= 0; b--){
			var c = regions[a].letters[b].contours;
			for(var i = c.length - 1; i >= 0; i--){
				dilation.data[c[i]] = 2
			}
		}
	}

	console.timeEnd('morphological dilation')

	
	
	var pixmap = new Uint16Array(width * height)
	var intoct = new Uint32Array(16 * 16 * 16)
	var extoct = new Uint32Array(16 * 16 * 16)
	var zeroes = new Uint32Array(16 * 16 * 16)

	var labtab = {};

	console.time("color filter")

	for(var region_num = 0; region_num < regions.length; region_num++){

		
		var line = regions[region_num]
		// console.log(line)
		intoct.set(zeroes)
		extoct.set(zeroes)
		
		var x0 = Math.max(0, line.x0 - xpad),
			x1 = Math.min(width, line.x1 + xpad),
			y0 = Math.max(0, line.y0 - ypad),
			y1 = Math.min(height, line.y1 + ypad);

		for(var y = y0; y < y1; y++){
			for(var x = x0; x < x1; x++){
				var p = x + y * width;

				var rgb_color = Math.floor(src.data[4 * p] / 8) + 
								Math.floor(src.data[4 * p + 1] / 8) * 32 + 
								Math.floor(src.data[4 * p + 2] / 8) * 1024;
				// here we round the color kinda to speed up rgb->lab conversion
				// because the conversion is kinda slow

				if(!(rgb_color in labtab)){

					var lab = rgb2lab([src.data[4 * p], src.data[4 * p + 1], src.data[4 * p + 2]])
					// var color =     Math.floor((2 * lab[0] + 30) / 16) + 
					// 				Math.floor((lab[1] + 130) / 16) * 16 + 
					// 				Math.floor((lab[2] + 130) / 16) * 256
					var color = Math.round((2 * lab[0] + 40) / 16) |
								Math.round((lab[1] + 128) / 16) << 4 |
								Math.round((lab[2] + 128) / 16) << 8;

					labtab[rgb_color] = color					
				}else{
					var color = labtab[rgb_color]
				}

				pixmap[p] = color
				if(dilation.data[p] === 1){
					extoct[color]++
					extoct[color+16]++
					extoct[color-16]++
					extoct[color+256]++
					extoct[color-256]++
					extoct[color+1]++
					extoct[color-1]++
				}else if(dilation.data[p] === 2){
					intoct[color]++
					intoct[color+16]++
					intoct[color-16]++
					intoct[color+256]++
					intoct[color-256]++
					intoct[color+1]++
					intoct[color-1]++
				}
			}
		}

		// var invmap = {}
		// for(var i in labtab){
		// 	invmap[labtab[i]] = [(i % 32) * 8, (Math.floor(i / 32) % 32) * 8, (Math.floor(i / 1024)) * 8 ]
		// }

		// var merp = document.createElement('canvas')
		// merp.width = 256
		// merp.height = 256
		// merp.style.background = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAHUlEQVQIW2NkgILFixf/ZwSxQYzY2FhGRhgDJAgAwf8K7NQ1zbQAAAAASUVORK5CYII=)'
		// document.body.appendChild(merp)
		// merp = merp.getContext('2d')
		
		
		
		for(var y = y0; y < y1; y++){
			for(var x = x0; x < x1; x++){
				var p = x + y * width;	
				var color = pixmap[p]
				if(intoct[color] / (1 + extoct[color]) > 3){
					marker.data[p] = Math.min(255, 2 * (intoct[color] / (1 + extoct[color])))
					
				}

				// var l = (color % 16) * 16, 
				// 	a = (Math.floor(color / 16) % 16) * 16, 
				// 	b = (Math.floor(color / 256)) * 16;
				// if(intoct[color] / (1 + extoct[color]) > 2){
				// 	merp.fillStyle = 'rgb(' + invmap[color].join(',') + ')'
				// 	merp.fillRect(l, b, 16, 16)
				// }else{

				// 	merp.strokeStyle = 'rgb(' + invmap[color].join(',') + ')'
				// 	merp.lineWidth = 3
				// 	merp.strokeRect(l + merp.lineWidth, b + merp.lineWidth, 16 - 2 * merp.lineWidth, 16 - 2 * merp.lineWidth)
				// }
			}
		}
		
	}

	console.timeEnd('color filter')

	return marker
}



function split_lines(regions, swt){
	var width = swt.cols,
		height = swt.rows;
	
	// this is a kind of constrained linear crawl upwards and downwards to 
	// detect vertical lines that are used to separate content

	return regions.map(function(line){
		var buf = [line.letters[0]], groups = [];
		for(var i = 0; i < line.letters.length - 1; i++){
			var cur = line.letters[i],
				next = line.letters[i + 1];
			
			if(next.x0 - cur.x1 > Math.sqrt(Math.min(next.area, cur.area))){
				var streak = -1, separators = 0, y = Math.floor(cur.cy / 2 + next.cy / 2);
				var goal = 3 * Math.max(cur.height, next.height)
				for(var x = cur.x1; x < next.x0; x++){
					var n = y * width + x;
					if(swt.data[n] > 0){
						if(streak < 0) streak = x;
					}else{
						if(streak > 0){
							var mid = Math.floor(x / 2 + streak / 2), explored = 0;
							for(var t = 0; t < goal; t++){
								var k = (y + t) * width + mid;
								if(swt.data[k] > 0){
									explored++;
								}else if(swt.data[k + 1] > 0){
									mid++; explored++
								}else if(swt.data[k - 1] > 0){
									mid--; explored++
								}else break;
							}
							var mid = Math.floor(x / 2 + streak / 2);
							for(var t = 0; t < goal; t++){
								var k = (y - t) * width + mid;
								if(swt.data[k] > 0){
									explored++;
								}else if(swt.data[k + 1] > 0){
									mid++; explored++
								}else if(swt.data[k - 1] > 0){
									mid--; explored++
								}else break;
							}
							if(explored > goal) separators++;
						}
						streak = -1
					}
				}
				if(separators > 0){ // break it off
					groups.push(buf)
					buf = []
				}
			}
			buf.push(next)
		}
		groups.push(buf)
		// return groups
		return (groups.length == 1) ? [line] : groups
	})
}


function exclude_occlusions(letters, width, height, params){
	console.time("excluding occlusions")
	
	var buffer = new jsfeat.matrix_t(width, height, jsfeat.S32_t | jsfeat.C1_t); 

	for(var i = 0; i < letters.length; i++){
		var contour = letters[i].contours;
		for(var j = 0; j < contour.length; j++){
			buffer.data[contour[j]] = i + 1;
		}
	}


	// var removed = [];

	// letters.map(function(letter, i){
	// 	var another = [];
	// 	var occlusions = 0;
	// 	for(var x = letter.x0; x < letter.x1; x++){
	// 		for(var y = letter.y0; y < letter.y1; y++){
	// 			var group = buffer.data[x + width * y];
	// 			if(group && group != i + 1){
	// 				occlusions++;
	// 				if(another.indexOf(group) == -1){
	// 					another.push(group)
	// 				}
	// 			}
	// 		}
	// 	}
	// 	// if it has few occlusions, it gets a free pass
	// 	if(another.length < params.letter_occlude_thresh) return false;

	// 	return [i, another]
	// })
	// .filter(function(e){ return e })
	// .sort(function(a, b){
	// 	// kill these things in order of area ascending
	// 	// return a.area - b.area
	// 	// return a[1].length - b[1].length
	// 	return a[0].area - b[0].area
	// }).forEach(function(e){
	// 	var i = e[0],
	// 		another = e[1];
		
	// 	var remaining = another.filter(function(e){ return removed.indexOf(e) == -1 }).length;
	// 	if(remaining >= params.letter_occlude_thresh){
	// 		removed.push(i)
	// 	}
	// });

	// return letters.filter(function(letter, i){
	// 	return removed.indexOf(i) == -1
	// })


	return letters.filter(function(letter, i){
		var another = [];
		var occlusions = 0;
		for(var x = letter.x0; x < letter.x1; x++){
			for(var y = letter.y0; y < letter.y1; y++){
				var group = buffer.data[x + width * y];
				if(group && group != i + 1){
					occlusions++;
					if(another.indexOf(group) == -1){
						another.push(group)
					}
				}
			}
		}
		if(another.length >= params.letter_occlude_thresh) return false;
		// if(occlusions > 120) return false;
		// if(occlusions / letter.contours.length > params.occlusion_ratio) return false;
		return true;
	})
	console.timeEnd("excluding occlusions")
}

function count_bits(v){
	var c = 0; // count the number of bits set in v
	for (c = 0; v; c++) {
		v &= v - 1; // clear the least significant bit set
	}
	return c
}

// Array.prototype.sum = function(){
// 	for(var s = 0, i = 0; i < this.length; i++) s += this[i];
// 	return s
// }

// Array.prototype.mean = function(){
// 	return this.sum() / this.length;
// }

// Array.prototype.std = function(){
// 	var mu = this.mean()
// 	for(var s = 0, i = 0; i < this.length; i++) s += (this[i] - mu) * (this[i] - mu);
// 	return Math.sqrt(s)
// }

// http://stackoverflow.com/questions/14846767/std-normal-cdf-normal-cdf-or-error-function

function cdf(x, mean, variance) {
	return 0.5 * (1 + erf((x - mean) / (Math.sqrt(2 * variance))));
}

function erf(x) {
	// save the sign of x
	var sign = (x >= 0) ? 1 : -1;
	x = Math.abs(x);

	// constants
	var a1 =  0.254829592;
	var a2 = -0.284496736;
	var a3 =  1.421413741;
	var a4 = -1.453152027;
	var a5 =  1.061405429;
	var p  =  0.3275911;

	// A&S formula 7.1.26
	var t = 1.0/(1.0 + p*x);
	var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
	return sign * y; // erf(-x) = -erf(x);
}

// maybe in the future we should replace this with a strongly
// connected components algorithm (or have some spatial heuristic to
// determine how wise it would be to consider the connection valid)
function connected_swt(swt, params){
	var dx8 = [-1, 1, -1, 0, 1, -1, 0, 1];
	var dy8 = [0, 0, -1, -1, -1, 1, 1, 1];
	var width = swt.cols, 
		height = swt.rows;

	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	var contours = []
	
	for(var i = 0; i < width * height; i++){
		if(marker.data[i] || !swt.data[i]) continue;

		var ix = i % width, iy = Math.floor(i / width)
		
		marker.data[i] = 1
		var contour = []
		var stack = [i]
		var closed;
		
		while(closed = stack.shift()){
			contour.push(closed)
			var cx = closed % width, cy = Math.floor(closed / width);
			var w = swt.data[closed];
			for(var k = 0; k < 8; k++){
				var nx = cx + dx8[k]
				var ny = cy + dy8[k]
				var n = ny * width + nx;

				if(nx >= 0 && nx < width &&
				   ny >= 0 && ny < height &&
				   swt.data[n] &&
				   !marker.data[n] &&
				   swt.data[n] <= params.stroke_ratio * w &&
				   swt.data[n] * params.stroke_ratio >= w){
					marker.data[n] = 1
					// update the average stroke width
					w = (w * stack.length + swt.data[n]) / (stack.length + 1)
					stack.push(n)
				}
			}
		}
		// contours.push(contour)
		if(contour.length >= params.min_area){
			contours.push(contour)	
		}
	}
	return contours
}





function connected_priority(masked){
	var dx8 = [-1, 1, -1, 0, 1, -1, 0, 1];
	var dy8 = [0, 0, -1, -1, -1, 1, 1, 1];
	var width = masked.cols, 
		height = masked.rows;

	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	var contours = []
	
	var min_area = 10;

	var big_queue = new HeapQueue(function(b, a){
		return masked.data[a] - masked.data[b]
	})
	for(var i = 0; i < width * height; i++){
		if(!masked.data[i]) continue;
		big_queue.push(i)
	}

	// for(var i = 0; i < width * height; i++){
	
	while(big_queue.length){
		var i = big_queue.pop()
		if(marker.data[i] || !masked.data[i]) continue;

		var ix = i % width, iy = Math.floor(i / width)
		
		marker.data[i] = 1
		var contour = []
		// var stack = [i]
		var stack = new HeapQueue(function(b, a){
			return masked.data[a] - masked.data[b]
		})
		stack.push(i)
		var w = masked.data[i];
		var counter = 0, mean = 0, M2 = 0;

		while(stack.length){
			var closed = stack.pop()

			contour.push(closed)
			var cx = closed % width, cy = Math.floor(closed / width);
			
			counter++
			var delta = masked.data[closed] - mean
			mean = mean + delta / counter
			M2 += delta * (masked.data[closed] - mean)

			for(var k = 0; k < 8; k++){
				var nx = cx + dx8[k]
				var ny = cy + dy8[k]
				var n = ny * width + nx;

				var std = Math.sqrt(M2/(counter - 1));

				if(nx >= 0 && nx < width &&
				   ny >= 0 && ny < height &&
				   masked.data[n] &&
				   !marker.data[n]
				   ){
					marker.data[n] = 1
					// console.log(marker.data[n] - w)
				    if(//(
				    	// (masked.data[n] <= max_ratio * w &&
				   		// masked.data[n] * max_ratio >= w) || 
				   		// Math.abs(masked.data[n] - w) < max_diff ||
				   		// masked.data[n] > 80
				   		// w - masked.data[n] < 10
				   		// masked.data[n] > 0
				   		// masked.data[n] >= Math.pow(w, 0.8)
				   		// masked.data[n] > 0
				   		// this is, for the record, an empirically
				   		// derived magic number, and by empirically
				   		// derived, i mean it was pulled out of
				   		// my ass, because it really isn't anything
				   		// of that sort
				   		Math.pow(masked.data[n], 1.5) > w
				   		// masked.data[n] / w > 0.5
				   		// w - masked.data[n] < 50
				   		// masked.data[n] > mean - 8 * std
				   		){
				    	// update the average stroke width
						w = (w * stack.length + masked.data[n]) / (stack.length + 1)


						stack.push(n)
				    }else{
						contour.push(n)
				    }
				}
			}
		}

		// contours.push(contour)
		if(contour.length >= min_area){
			contours.push(contour)	
		}
	}
	// visualize_matrix(marker)
	return contours
}



if(typeof IMPORTED == 'undefined') 
	importScripts('../lib/jsfeat-custom.js', 
				'swt2.js', 
				'connected.js', 
				'../lib/heapqueue.js', 
				'../lib/find-union.js', 
				'../lib/color.js', 
				'../lib/workerconsole.js');


onmessage = function(e){
	var msg = e.data;
	if(msg.action == 'swt'){
		console.beginBuffer()
		console.time('extract text lines')
		var lines = partial_swt(msg.imageData, msg.params);
		console.timeEnd('extract text lines')
		console.finishBuffer()
		// lines.forEach(function(line){
		// 	line.letters.forEach(function(letter){
		// 		delete letter.contours
		// 	})
		// })
		postMessage({
			action: 'swtdat',
			lines: lines
		})
	}
}

function visualize_matrix(mat, letters){
	postMessage({
		action: 'vizmat',
		matrix: mat,
		letters: letters
	})
}