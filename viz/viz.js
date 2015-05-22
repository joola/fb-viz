var cur
  , all
  , stepDate = 864e5
  , bh = d3.blackHole("#canvas")
  , progress = {
    state: 'init',
    process: 0
  }
  , df = d3.time.format('%d-%m-%Y')
  ;

function restart() {
  d3.json("../data/events.json", function (error, data) {
    if (error) return console.warn(error);

    bh.stop();
    cur = 0;
    all = data.length;
    progress.process = 0;
    progress.state = 'parsing';
    bh.start(data, 0, 0, true);
  });
}

bh.setting.drawTrack = true;
bh.setting.asyncParsing = true;
bh.on('getGroupBy', function (d) {
  return d.date;
})
  .on('getParent', function (d) {
    return d.author;
  })
  .on('getParentKey', function (d) {
    return d;
  })
  .on('getChildKey', function (d) {
    return d.resource_id;
    
  })
  .on('getCategoryKey', function (d) {
    return d.resource_id.replace(/.*?\.(.*)$/, '.$1');
  })
  .on('getParentLabel', function (d) {
    return d.nodeValue;
  })
  .on('getChildLabel', function (d) {
    return d.nodeValue.resource_id.replace(/.*\/(.*)$/, "$1");
  })
  .on('calcRightBound', function (l) {
    return l + stepDate;
  })
  .on('getVisibleByStep', function (d) {
    return !(d.action == "D");
  })
  .on('getCreateNearParent', function (d) {
    return d.action == "A";
  })
  .on('finished', function () {
    progress.state = "Completed";
  })
  .on('started', function () {
    progress.state = "Run...";
    progress.process = 0;
    cur = 0;
  })
  .on('processing', function (items, l, r) {
    cur += items ? items.length : 0;
    progress.state = df(new Date(l));
    progress.process = (cur / all) * 100;
  })
  .on('parsing', function () {
    progress.state = cur++ + ' of ' + all;
    progress.process = (cur / all) * 100;
  })
  .sort(function (a, b) {
    return d3.ascending(a.date + '_' + a.actOrder, b.date + '_' + b.actOrder);
  })
  .style('background', "#000")
;

!function () {
  var gui = new dat.GUI({
    load: JSON, preset: 'Default', autoPlace: false
  });

  d3.select('#gui-cont').node().appendChild(gui.domElement);

  var f = gui.addFolder('Items');
  f.add(bh.setting, 'alpha', 0.001, .1).step(.0001).listen();
  f.add(bh.setting, 'childLife', 0, 1000).step(5).listen();
  f.add(bh.setting, 'parentLife', 0, 1000).step(5).listen();
  f.add(bh.setting, 'rateOpacity', .01, 10).step(.1).listen();
  f.add(bh.setting, 'rateFlash', .01, 10).step(.1).listen();
  f.add(bh.setting, 'padding', 0, 100).step(5).listen();

  f = gui.addFolder('Behavior');
  f.add(bh.setting, 'skipEmptyDate').listen();
  f.add(bh.setting, 'asyncParsing').listen();
  f.add(bh.setting, 'increaseChildWhenCreated').listen();
  f.add(bh.setting, 'createNearParent').listen();
  f.add(bh.setting, 'speed', 0, 1000).step(5).listen();


  f = gui.addFolder('Drawing');
  f.add(bh.setting, 'blendingLighter').listen();
  f.add(bh.setting, 'drawTrack').listen();
  f.add(bh.setting, 'drawEdge').listen();
  f.add(bh.setting, 'drawChild').listen();
  f.add(bh.setting, 'drawChildLabel').listen();
  f.add(bh.setting, 'drawParent').listen();
  f.add(bh.setting, 'drawParentLabel').listen();
  f.add(bh.setting, 'drawPaddingCircle').listen();
  f.add(bh.setting, 'drawHalo').listen();
  f.add(bh.setting, 'drawAsPlasma').listen();
  f.add(bh.setting, 'drawParentImg').listen();
  f.add(bh.setting, 'hasLabelMaxWidth').listen();

  gui.add(progress, 'state').listen();
  gui.add(progress, 'process', 0, 100).listen();

  gui.add(window, 'restart');

  gui.remember(bh.setting);
}();

d3.select("#run").on('click', restart);

d3.select(window).on('resize', function () {
  var c = d3.select('#canvas').node();
  bh.size([c.clientWidth, c.clientHeight]);
});

d3.selectAll('.btn-hide')
  .on('click', function () {
    var p = d3.select(this.parentNode);
    p.classed('open', !p.classed('open'));
  });

restart();