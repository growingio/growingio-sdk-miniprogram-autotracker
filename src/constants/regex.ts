export const IPReg =
  /^((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}/i;
export const URLReg =
  /^(https?:\/\/)|(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*$/i;
export const UNIAPP_FUNC_REG = /^e[0-9]+$/;
export const ABTEST_SIGN_REG = /^\d+_gdp_abt_sign$/;
export const ABTEST_DATA_REG = /^\d+_gdp_abtd$/;
export const ID_REG = /^\d{1,10}$/;
export const IMP_DATA_REG = /^gioTrack(.+)/;
export const IMP_EVENTNAME_REG = /^[a-zA-Z_][0-9a-zA-Z_]{0,100}$/;
export const SWAN_XID_REG = /^_[0-9a-z]+/;
export const TARO_XID_REG = /^_n_[0-9]+$/;
export const TARO_EVENT_PROPS_REG = /^__reactProps\$[a-z0-9]+$/i;
export const TARO_EVENT_REACT_FUNC1_REG = /return [$\w]+.\w+\(/;
export const TARO_EVENT_REACT_FUNC2_REG = /return \w+\(/;
export const TARO_EVENT_VUE_FUNC1_REG = /return [$\w]+.\$emit\(['"]\w+/;
export const TARO_EVENT_VUE_FUNC2_REG = /return [$\w]+.\w+/;
export const TARO_EVENT_VUE_FUNC3_REG = /return [$\w]+/;
