require(['mock', 'Topology3D'], function(mock, Topology3D){

    function renderPage(){

        var network3D = new Topology3D('topology');

        network3D.initTopologyData(mock.data.topolist).done(function() {
            network3D.drawLayout();
        });
    }

    renderPage();
});