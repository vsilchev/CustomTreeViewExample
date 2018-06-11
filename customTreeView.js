/* customTreeView.js */

// prepare data
function formatData(data) {
  if (data) {
    var reqTreeJSON = JSON.parse(data);

    formatChildren = function(element, index, array) {
      var child = element[1];
      child.name = element[0];
      child.i = index;
      if (child.children) {
        child.children.forEach(formatChildren);
      }
      array[index] = child;
    };
    reqTreeJSON.children.forEach(formatChildren);

    return reqTreeJSON;
  } else {
    return null;
  }
}

// create a view
function createView(viewId) {
  var viz = $("#" + viewId);
  viz.html('<svg id="' + viewId + "-svg" + '"></svg>');
  return viz;
}

//
function updateView(viz, data, viewId) {
  if (data == null) {
    viz.html("<p><b>Nothing to show.</b></p>");
  } else {
    var levelWidth = 100,
      lastLevelWidth = 200,
      divWidth = viz.width(),
      nodeHeight = 20,
      paddingLeft = 50,
      paddingTop = 10,
      paddingRight = 160;

    var cr = 5.0;
    var duration = 500, // duration of transition when expanding/collapsing nodes
      i = 0;
    var nodePreffix = viewId + "-node-";
    if ($('#' + nodePreffix + '1').length) {
      return;
    }

    // Request Tree data object
    var root = d3.hierarchy(data);
    root.sort(function(a, b) {
      return a.height - b.height || a.id - b.id;
    });

    var svg = d3.select("#" + viewId + "-svg");
    var g = svg.append("g")
      .attr("transform", "translate(" + paddingLeft + "," + paddingTop + ")");

    // root.children.forEach(collapse);
    root.x0 = nodeHeight * root.leaves().length / 2;
    root.y0 = 0;

    // layoutWidth and layoutHeight for calculaton of D3 Cluster Layout
    var layoutWidth = levelWidth * Math.max(2, d3.max(root.leaves(), function(d) {
      return d.depth;
    }));
    var layoutHeight = nodeHeight * Math.max(4, root.leaves().length);

    // svgWidth and svgHeight for resizing of SVG-block
    var svgWidth = Math.max(divWidth, paddingLeft + d3.max(root.leaves(), function(d) {
      return lastLevelWidth + levelWidth * (d.depth - 1) +
        Math.max(paddingRight, 8 * (d.data.value ? d.data.value.length : 0)); // 8 px per character (avg)
    }));
    var svgHeight = layoutHeight + paddingTop;

    // Compute the new tree layout.
    svg.attr("width", svgWidth).attr("height", svgHeight);

    // run rendering from root node
    update(root);

    function collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    // Rendering
    function update(source) {

      // recalculate layout for present nodes
      var d3tree = d3.cluster().size([layoutHeight, layoutWidth]);
      d3tree(root);

      // Normalize for fixed-depth.
      root.leaves().forEach(function(d) {
        d.y = d.y + lastLevelWidth - levelWidth;
      });

      // Update the links…
      var link = g.selectAll("path")
        .data(root.descendants().slice(1), function(d) {
          return d.id;
        });

      // Enter any new links at the parent's previous position.
      link.enter().append("path")
        .attr("class", "link")
        .attr("d", function(d) {
          var o = {
            x: source.x0,
            y: source.y0
          };
          return linkFromTo(o, o);
        });

      // Transition links to their new position.
      g.selectAll("path.link").transition()
        .duration(duration)
        .attr("d", function(d) {
          return linkFromTo(d.parent, d);
        });

      // Transition exiting nodes to the parent's new position.
      link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
          var o = {
            x: source.x,
            y: source.y
          };
          return linkFromTo(o, o);
        })
        .remove();

      // Enumerate nodes so each node has unique id
      var node = g.selectAll("g")
        .data(root.descendants(), function(d) {
          return d.id || (d.id = ++i);
        });

      // New nodes
      var nodeEnter = node.enter().append("g")
        .on("click", click)
        .attr("id", function(d) {
          return nodePreffix + d.id;
        })
        .attr("transform", function(d) {
          return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .attr("class", function(d) {
          return "node" + (d.children ? " node--expanded" : (d._children ? " node--collapsed" : " node--leaf"));
        });

      // draw circles
      nodeEnter.append("circle").attr("r", 1e-6);

      // add "name" label
      nodeEnter.append("text")
        .attr("dy", 4)
        .attr("x", -9)
        .attr("class", "node-name")
        .style("text-anchor", "end")
        .text(function(d) {
          return d.data.name;
        })
        .style("fill-opacity", 1e-6);

      // add "value" label to leaves
      var nodeEnterLeaves = nodeEnter.filter(function(d) {
          return d.data.value;
        })
        .append("text")
        .attr("dy", 4)
        .attr("x", 9)
        .attr("class", "node-value")
        .style("text-anchor", "start")
        .text(function(d) {
          return d.data.value;
        }).style("fill-opacity", 1e-6);

      // source (clicked) node
      g.select("#" + nodePreffix + source.id)
        .attr("class", function(d) {
          return "node" + (d.children ? " node--expanded" : (d._children ? " node--collapsed" : " node--leaf"));
        });

      // Update nodes
      var nodeUpdate = g.selectAll("g.node").transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")";
        });

      nodeUpdate.select("circle").attr("r", cr);
      nodeUpdate.selectAll("text").style("fill-opacity", 1);

      // Transition exiting nodes to the parent's new position.
      var nodeExit = node.exit();
      nodeExit.selectAll("text").remove();
      nodeExit.transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + source.y + "," + source.x + ")";
        })
        .remove()
        .select("circle").attr("r", 1e-6);


      // Stash the old positions for transition.
      root.descendants().forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Bezier curve that connect two nodes
    function linkFromTo(sourceNode, targetNode) {
      return "M" + (sourceNode.y + cr) + "," + sourceNode.x +
        "C" + (sourceNode.y + 0.5 * levelWidth) + "," + sourceNode.x +
        " " + (sourceNode.y + targetNode.y) / 2 + "," + targetNode.x +
        " " + (targetNode.y - cr) + "," + targetNode.x;
    }

    // Toggle children on click.
    function click(d, ix, gr) {
      if (d.children) { // collapse node
        d._children = d.children;
        d.children = null;
      } else { // expand node
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }
  }
}

// main code
var treeViewId = "tree-view";
var testString = '{"name":"root","children": [["time",{"type":"string","value":"09-06-2018 15:57:49"}],["URL",{"type":"Object","value":"http://example.com/resource?foo=yes&bar=1","children":[["scheme",{"type":"string","value":"http"}],["host",{"type":"string","value":"example.com"}],["path",{"type":"string","value":"resource"}],["query",{"type":"object","value":"foo=yes&bar=1","children":[["foo",{"type":"string","value":"yes"}],["bar",{"type":"string","value":"1"}]]}]]}]]}'

var dataObject = formatData(testString);
var vizObject = createView(treeViewId);

updateView(vizObject, dataObject, treeViewId);
