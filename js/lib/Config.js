//所需文件配置目录
require.config({
	//这里的baseUrl会自动补全后面的/
	baseUrl: "./js/lib",
	paths: {
		"three": "three",
		"mock": "mock",

		"Topology3D": "Topology3D",
		"ThreeControls": "ThreeControls"
	},
	shim: {}
});