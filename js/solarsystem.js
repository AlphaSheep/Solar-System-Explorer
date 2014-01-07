/*
Solar System Explorer

Copyright (c) 2013 Brendan Gray and Sylvermyst Technologies.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

 */



/*
 * This started as a test. As usual, I apologise for sloppy coding and a lack of comments.
 */


framRateLimit = 30;

canvasHeight = 300;
canvasWidth = Math.min(window.innerWidth-20, 2000);

minsize = 3;
maxsize = canvasWidth*2;
beltEndSize = 10;


// sizeScale = 2000000; // Scaling factor in km per pixel for setting object sizes
startPositionScale = 200000; // Scaling factor in km per pixel for setting positions.
positionScale = startPositionScale;

sizeExaggeration = 1;
sizeScale = positionScale/sizeExaggeration;

minGridSpacing = 4; // minimum number of pixels between grid lines

zoomSpeed = 1.05;
startScreenx = 100;
screenx = startScreenx;
targetScreenX = false;

moveSpeed = 20;
dragThreshold = 10; // number of pixels the mouse needs to move in order to be considered a drag.

moveRight = false;
moveLeft = false;
dragging = false;
zoomUp = false;
zoomDown = false;
dragStartX = 0;

displayBody = 0;

thisTime = 0;
lastTime = 0;

autoScrollSpeed = 1; // pixels/millisecond.
zoomScrollSpeed = 0.12;
scrollSpeed = 0;


updateDisplay = 0;
updateDisplayFrequency = 5;


function init(){

    $("#posscale").text(numberWithCommas(200000));


    canvas = document.getElementById("gameCanvas");
    canvas.height = canvasHeight;
    canvas.width = canvasWidth;

    stage = new createjs.Stage("gameCanvas");


    loadProgressLabel = new createjs.Text("","18px Verdana","#eee");
    loadProgressLabel.lineWidth = 200;
    loadProgressLabel.textAlign = "center";
    loadProgressLabel.x = canvas.width/2;
    loadProgressLabel.y = canvas.height/2-20;
    stage.addChild(loadProgressLabel);

    vanishThreshold = 15;

    loadingBarContainer = new createjs.Container();
    loadingBarHeight = 20;
    loadingBarWidth = 300;
    LoadingBarColor = createjs.Graphics.getRGB(1, 0.3, 0.0);


    loadingBar = new createjs.Shape();
    loadingBar.graphics.beginFill("#789").drawRect(0, 0, 1, loadingBarHeight).endFill();

    frame = new createjs.Shape();
    padding = 3;
    frame.graphics.setStrokeStyle(1).beginStroke("#789").drawRect(-padding/2, -padding/2, loadingBarWidth+padding, loadingBarHeight+padding);

    loadingBarContainer.addChild(loadingBar, frame);
    loadingBarContainer.x = Math.round(canvas.width/2 - loadingBarWidth/2);
    loadingBarContainer.y = 100;
    stage.addChild(loadingBarContainer);

    preload = new createjs.LoadQueue(false);
    preload.addEventListener("complete", handleComplete);
    preload.addEventListener("progress", handleProgress);


    //preload.loadFile({id: "background", src:"img/background1.png"});
    preload.loadManifest([{id: "background", src:"img/background1.png"},
                          {id: "rover", src:"img/rover1.png"}]);



    stage.update();

}


function CelestialBody(name, size, position, color, displayLimit, parent, type)
{
    this.name = name;
    this.size = size;  // size is an array of [equatorial radius, polar radius]
    this.position = position;
    this.displayLimit = displayLimit;
    this.color = color;
    this.rings = new Array();
    this.parent = parent || null; // if a parent was defined, saves it, otherwise saves null.
    this.type = type || "Object"; // possible types are "Object", "Belt", "Cloud", "Nebula", "Galaxy"
    this.children = new Array();
    this.center = (position[0]+position[1])/2;
    if (this.parent) this.center += this.parent.center;
    this.id = -1;

    this.screenSizeX = 1;
    this.screenSizeY = 1;

    this.shape = new createjs.Shape();
    //this.shape.graphics.beginFill(this.color).drawEllipse(100,100,20,20);

    this.label = new createjs.Container();

    this.label1 = new createjs.Text(this.name,"12px Verdana","#eee");
    this.label1.visible = true;
    this.label1.lineWidth = 200;
    this.label1.textAlign = "center";
    this.label1.outline = 0;

    this.label2 = new createjs.Text(this.name,"12px Verdana","#000");
    this.label2.visible = true;
    this.label2.lineWidth = 200;
    this.label2.textAlign = "center";
    this.label2.outline = 3;
    this.label2.shadow = new createjs.Shadow("#000",2,2,4);

    this.label.addChild(this.label2, this.label1);

    this.displayObject = new createjs.Container();
    this.displayObject.addChild(this.shape, this.label);

    this.resize = function(scale)
    {
        newX = this.size[0]/scale*2;
        if (newX < minsize) {this.screenSizeX = minsize;}
        else if (newX > maxsize) {this.screenSizeX = maxsize;}
        else {this.screenSizeX = newX;}

        newY = this.size[1]/scale*2;
        if (newY < minsize) {this.screenSizeY = minsize;}
        else if (newY > maxsize) {this.screenSizeY = maxsize;}
        else {this.screenSizeY = newY;}
    };

    this.hide = function()
    {
        this.displayObject.visible = false;
    };


    this.draw = function()
    {
        this.shape.graphics.c().f(this.color).de(newX,newY,this.screenSizeX,this.screenSizeY);
        this.label.setTransform(newX+this.screenSizeX/2,canvasHeight/2+10);
    };


    this.show = function(screenx, sizeScale, positionScale)
    {
        if (positionScale > this.displayLimit*vanishThreshold)
        {
            this.hide();
            return;
        }
        else
        {
            this.displayObject.visible = true;
            this.shape.visible = true;
            this.label.visible = true;

            this.resize(sizeScale);
            newX = (this.center/positionScale)+screenx-this.screenSizeX/2;

            if (newX*2 < -this.screenSizeX || newX*2 > canvasWidth*2 -this.screenSizeX)
            {
                this.hide();
                return;
            }

            newY = canvasHeight/2-this.screenSizeY/2;
            this.draw();
            this.displayObject.alpha = 1-positionScale/(this.displayLimit*vanishThreshold);

            if (positionScale > this.displayLimit)
            {
                this.label.visible = false;
            }
            else
            {
                this.label.alpha = 1-positionScale/(this.displayLimit);
            }
        }
    };
}


function Belt(name, position, color, displayLimit, level, parent, type)
{
    this.name = name;
    this.position = position;
    this.displayLimit = displayLimit;
    this.color = color;
    this.parent = parent || null; // if a parent was defined, saves it, otherwise saves null.
    this.type = type || "Object"; // possible types are "Object", "Belt", "Cloud", "Nebula", "Galaxy"
    this.level = level;
    this.children = new Array();
    this.center = (position[0]+position[1])/2;
    if (this.parent) this.center += this.parent.center;
    this.id = -1;

    this.screenSizeX = 1;
    this.screenSizeY = 1;

    this.shape = new createjs.Shape();

    this.label = new createjs.Container();

    this.label1 = new createjs.Text(this.name,"12px Verdana","#eee");
    this.label1.visible = true;
    this.label1.lineWidth = 200;
    this.label1.textAlign = "center";
    this.label1.outline = 0;

    this.label2 = new createjs.Text(this.name,"12px Verdana","#000");
    this.label2.visible = true;
    this.label2.lineWidth = 200;
    this.label2.textAlign = "center";
    this.label2.outline = 3;
    this.label2.shadow = new createjs.Shadow("#000",2,2,4);

    this.label.addChild(this.label2, this.label1);

    this.displayObject = new createjs.Container();
    this.displayObject.addChild(this.shape, this.label);

    this.hide = function()
    {
        this.displayObject.visible = false;
    };

    this.show = function(screenx, sizeScale, positionScale)
    {
        if (positionScale > this.displayLimit*vanishThreshold)
        {
            this.hide();
        }
        else
        {
            this.displayObject.visible = true;
            this.shape.visible = true;
            this.label.visible = true;

            leftX = (this.position[1]/positionScale)+screenx;
            rightX = (this.position[0]/positionScale)+screenx;
            newX = (leftX+rightX)/2;
            if (newX < -this.screenSizeX/2 || newX > canvasWidth - this.screenSizeX/2) this.hide();
            else
            {
                newY = canvasHeight/2-this.level;
                this.shape.graphics.c().s(this.color).ss(2).mt(leftX,newY-beltEndSize/2).lt(leftX,newY+beltEndSize/2).mt(rightX,newY-beltEndSize/2).lt(rightX,newY+beltEndSize/2).mt(leftX,newY).lt(rightX,newY);
                this.label.setTransform(newX+this.screenSizeX/2,canvasHeight/2-this.level-20);
                this.displayObject.alpha = 1-positionScale/(this.displayLimit*vanishThreshold);
            }
            if (positionScale > this.displayLimit)
            {
                this.label.visible = false;
            }
            else
            {
                if (positionScale*10 > this.displayLimit)
                this.label.alpha = 1-positionScale/(this.displayLimit);
            }
        }
    };
}


function createBodies(){

    stars = new Array();
    planets = new Array();

    stars[0] = new CelestialBody("The Sun", [696342, 696342], [0, 0], "#ee8", 1000000000000000);

        // Major Planets

    stars[0].children[0] = new CelestialBody("Mercury", [2440, 2440], [46001200, 69816900], "#888",1300000);
    stars[0].children[1] = new CelestialBody("Venus", [6052, 6052], [107477000, 108939000], "#bba",1300000);
    stars[0].children[2] = new CelestialBody("Earth", [6378, 6357], [152098232, 147098290], "#56e",3800000);
    stars[0].children[3] = new CelestialBody("Mars", [3396, 3376], [249209300, 206669000], "#e62",3000000);
    stars[0].children[4] = new CelestialBody("Jupiter", [71492, 66854], [816520800, 740573600], "#a86",18000000);
    stars[0].children[5] = new CelestialBody("Saturn", [60268, 54364], [1513325783, 1353572956], "#db8",34000000);
    stars[0].children[6] = new CelestialBody("Uranus", [25559, 24973], [3004419704, 2748938461], "#9ff",39000000);
    stars[0].children[7] = new CelestialBody("Neptune", [24764, 24341], [4553946490, 4452940833], "#46e",100000000);

        // Dwarf Planets

    stars[0].children[8] = new CelestialBody("Ceres", [487, 455], [445280000, 382520000], "#ecb",7000000);
    stars[0].children[9] = new CelestialBody("Pluto", [1153, 1153], [7311000000, 4437000000], "#c94",30000000);
    stars[0].children[10] = new CelestialBody("Haumea", [980, 498], [7710000000, 5194000000], "#aaa",9000000);
    stars[0].children[11] = new CelestialBody("Makemake", [751, 715], [7939000000, 5760000000], "#888",15000000);
    stars[0].children[12] = new CelestialBody("Eris", [1163, 1163], [14602000000, 5723000000], "#888",180000000);

        // Moons

    stars[0].children[2].children[0] = new CelestialBody("The Moon", [1738, 1736], [405503, 363295], "#888",8000, stars[0].children[2]);

    stars[0].children[3].children[0] = new CelestialBody("Phobos", [7, 5], [9518, 9234], "#888",250, stars[0].children[3]);
    stars[0].children[3].children[1] = new CelestialBody("Deimos", [4, 3], [23471, 23456], "#888",250, stars[0].children[3]);

    stars[0].children[4].children[0] = new CelestialBody("Io", [1830, 1815], [423400, 420000], "#fe9",10000, stars[0].children[4]);
    stars[0].children[4].children[1] = new CelestialBody("Europa", [1561, 1561], [676938, 664862], "#a97",7000, stars[0].children[4]);
    stars[0].children[4].children[2] = new CelestialBody("Ganymede", [2634, 2634], [1071600, 1069200], "#997",15000, stars[0].children[4]);
    stars[0].children[4].children[3] = new CelestialBody("Callisto", [2410, 2410], [1897000, 1869000], "#665",18000, stars[0].children[4]);

    stars[0].children[5].children[0] = new CelestialBody("Mimas", [207.8, 190.6], [189176, 181902], "#888",950, stars[0].children[5]);
    stars[0].children[5].children[1] = new CelestialBody("Enceladus", [257, 248], [239000, 236800], "#a98",950, stars[0].children[5]);
    stars[0].children[5].children[2] = new CelestialBody("Tethys", [538, 526], [294648, 294590], "#cb9",5400, stars[0].children[5]);
    stars[0].children[5].children[3] = new CelestialBody("Dione", [564, 560], [378226, 376566], "#777",1950, stars[0].children[5]);
    stars[0].children[5].children[4] = new CelestialBody("Rhea", [766, 762], [527771, 526445], "#aaa",8900, stars[0].children[5]);
    stars[0].children[5].children[5] = new CelestialBody("Titan", [2576, 2576], [1257060, 1186680], "#aa3",25000, stars[0].children[5]);
    stars[0].children[5].children[6] = new CelestialBody("Iapetus", [746, 712], [3662704, 3458936], "#ddd",60000, stars[0].children[5]);

    stars[0].children[6].children[0] = new CelestialBody("Ariel", [581, 578], [191020, 190791], "#986",1800, stars[0].children[6]);
    stars[0].children[6].children[1] = new CelestialBody("Umbriel", [585, 585], [267037, 264963], "#655",1800, stars[0].children[6]);
    stars[0].children[6].children[2] = new CelestialBody("Titania", [788, 788], [436390, 435430], "#877",8200, stars[0].children[6]);
    stars[0].children[6].children[3] = new CelestialBody("Oberon", [761, 761], [584337, 582703], "#766",2900, stars[0].children[6]);
    stars[0].children[6].children[4] = new CelestialBody("Miranda", [240, 233], [129558, 129222], "#aaa",1450, stars[0].children[6]);

    stars[0].children[7].children[0] = new CelestialBody("Triton", [1353, 1353], [354765, 354753], "#eab",6900, stars[0].children[7]);

    stars[0].children[9].children[0] = new CelestialBody("Charon", [604, 607], [19571, 19571], "#a97",450, stars[0].children[9]);

    stars[0].children[10].children[0] = new CelestialBody("Hi'iaka", [195, 195], [52439, 47321], "#aaa",900, stars[0].children[10]);
    stars[0].children[10].children[1] = new CelestialBody("Namaka", [85, 85], [32046, 19268], "#888",450, stars[0].children[10]);

    stars[0].children[12].children[0] = new CelestialBody("Dysnomia", [342, 342], [37836, 36864], "#755",840, stars[0].children[12]);

        // Clouds and belts

    stars[0].children[13] = new Belt("Asteroid Belt", [493672973, 314155528], "#841", 11000000, 20);
    stars[0].children[14] = new Belt("Kuiper Belt", [7031099920, 5834316960], "#841", 60000000, 20);
    stars[0].children[15] = new Belt("Scattered Disc", [14959787070, 4487936121], "#822", 1200000000, 50);
    stars[0].children[16] = new Belt("Oort Cloud", [299195741400, 7479893540000], "#888", 300000000000, 20);


        // Other stars

    stars[1] = new CelestialBody("Alpha Centauri A", [854412, 854412], [41304667000000,41304667000000], "#ee8", 600000000000);
    stars[1].children[0] = new CelestialBody("Alpha Centauri B", [602336, 602336], [5300000000, 1670000000], "#eb8", 27000000, stars[1]);
    stars[1].children[0].children[0] = new CelestialBody("Alpha Centauri Bb", [6633, 6633], [5983930,5983930], "#d86", 46000, stars[1].children[0]);
    stars[2] = new CelestialBody("Proxima Centauri", [98184, 98184], [40134399700000,40134399700000], "#d42", 12000000000);


}

function generateBodyList()
{
    bodies = new Array();
    for (i=0; i<stars.length; i++)
    {
        bodies[bodies.length] = stars[i];
        for (j=0; j<stars[i].children.length; j++)
        {
           bodies[bodies.length] = stars[i].children[j];
           for (k=0; k<stars[i].children[j].children.length; k++)
           {
              bodies[bodies.length] = stars[i].children[j].children[k];
           }
        }
    }

    for (i=0; i<bodies.length; i++)
    {
        bodies[i].shape.bodyID = i;
        bodies[i].show(screenx, sizeScale, positionScale);
        stage.addChild(bodies[i].displayObject);
    }
}


function getBodyList()
{
    for (i=0; i<stars.length; i++)
    {
        bodies[bodies.length] = stars[i];
        for (j=0; j<stars[i].children.length; j++)
        {
           bodies[bodies.length] = stars[i].children[j];
           for (k=0; k<stars[i].children[j].children.length; k++)
           {
              bodies[bodies.length] = stars[i].children[j].children[k];
           }
        }
    }
}


function log10(x)
{
    return Math.log(x)/Math.LN10;
}


function screenCenter()
{
     return (canvasWidth/2 - screenx)*positionScale;
}


function numberWithCommas(x)
{
    /*
     * Taken from http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
     */
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}


function generateGrid()
{
    minorHorizGrid = new Array();
    minorVertGrid = new Array();

    majorHorizGrid = new Array();
    majorVertGrid = new Array();

    outerHorizGrid = new Array();
    outerVertGrid = new Array();

    maxHorizGridNum = Math.ceil(2*canvasWidth/minGridSpacing)+1;
    maxVertGridNum = Math.ceil(2*canvasHeight/minGridSpacing)+1;

    for (i=0; i<maxHorizGridNum; i++)
    {
        if (i%100===0)
        {
            outerHorizGrid[outerHorizGrid.length] = new createjs.Shape();
            outerHorizGrid[outerHorizGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(0,canvasHeight);
            outerHorizGrid[outerHorizGrid.length-1].locid = i;
            stage.addChild(outerHorizGrid[outerHorizGrid.length-1]);
        }
        else if (i%10===0)
        {
            majorHorizGrid[majorHorizGrid.length] = new createjs.Shape();
            majorHorizGrid[majorHorizGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(0,canvasHeight);
            majorHorizGrid[majorHorizGrid.length-1].locid = i;
            stage.addChild(majorHorizGrid[majorHorizGrid.length-1]);
        }
        else
        {
            minorHorizGrid[minorHorizGrid.length] = new createjs.Shape();
            minorHorizGrid[minorHorizGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(0,canvasHeight);
            minorHorizGrid[minorHorizGrid.length-1].locid = i;
            stage.addChild(minorHorizGrid[minorHorizGrid.length-1]);
        }
    }

    for (i=Math.floor(-maxVertGridNum/2); i<=Math.ceil(maxVertGridNum/2); i++)
    {

        if (i%100===0)
        {
            outerVertGrid[outerVertGrid.length] = new createjs.Shape();
            outerVertGrid[outerVertGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(canvasWidth,0);
            outerVertGrid[outerVertGrid.length-1].locid = i;
            stage.addChild(outerVertGrid[outerVertGrid.length-1]);
        }
        else if (i%10===0)
        {
            majorVertGrid[majorVertGrid.length] = new createjs.Shape();
            majorVertGrid[majorVertGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(canvasWidth,0);
            majorVertGrid[majorVertGrid.length-1].locid = i;
            stage.addChild(majorVertGrid[majorVertGrid.length-1]);
        }
        else
        {
            minorVertGrid[minorVertGrid.length] = new createjs.Shape();
            minorVertGrid[minorVertGrid.length-1].graphics.c().ss(1).s("#fff").mt(0,0).lt(canvasWidth,0);
            minorVertGrid[minorVertGrid.length-1].locid = i;
            stage.addChild(minorVertGrid[minorVertGrid.length-1]);
        }
    }
}


function generateSimplerGrid()
{
    minorHorizGrid = new createjs.Shape();
    minorVertGrid = new createjs.Shape();
    majorHorizGrid = new createjs.Shape();
    majorVertGrid = new createjs.Shape();
    outerHorizGrid = new createjs.Shape();
    outerVertGrid = new createjs.Shape();

    stage.addChild(minorHorizGrid);
    stage.addChild(minorVertGrid);
    stage.addChild(majorHorizGrid);
    stage.addChild(majorVertGrid);
    stage.addChild(outerHorizGrid);
    stage.addChild(outerVertGrid);

    minorHorizGrid.graphics.c().ss(1).s("#fff");
    minorVertGrid.graphics.c().ss(1).s("#fff");
    majorHorizGrid.graphics.c().ss(1).s("#fff");
    majorVertGrid.graphics.c().ss(1).s("#fff");
    outerHorizGrid.graphics.c().ss(1).s("#fff");
    outerVertGrid.graphics.c().ss(1).s("#fff");

    maxHorizGridNum = Math.ceil(2*canvasWidth/minGridSpacing)+1;
    maxVertGridNum = Math.ceil(2*canvasHeight/minGridSpacing)+1;

}

function adjustSimplerGrid()
{
    realMinGridSpacing = minGridSpacing*positionScale;
    realGridSpacing = Math.pow(10, Math.ceil(log10(realMinGridSpacing+1)));
    screenGridSpacing = (realGridSpacing/positionScale);

    screenLeftPos = -screenx*positionScale;
    gridRealStartx = Math.floor(screenLeftPos/realGridSpacing/100)*100*realGridSpacing;
    gridScreenStartx = (gridRealStartx/positionScale) + screenx;

    minorHorizGrid.graphics.c().ss(1).s("#fff");
    minorVertGrid.graphics.c().ss(1).s("#fff");
    majorHorizGrid.graphics.c().ss(1).s("#fff");
    majorVertGrid.graphics.c().ss(1).s("#fff");
    outerHorizGrid.graphics.c().ss(1).s("#fff");
    outerVertGrid.graphics.c().ss(1).s("#fff");

    for (i=0; i<maxHorizGridNum; i++)
    {
        screenGridxposition = gridScreenStartx + screenGridSpacing*i;
        if (i%100===0)
            outerHorizGrid.graphics.mt(screenGridxposition,0).lt(screenGridxposition,canvasHeight);
        else if (i%10===0)
            majorHorizGrid.graphics.mt(screenGridxposition,0).lt(screenGridxposition,canvasHeight);
        else
            minorHorizGrid.graphics.mt(screenGridxposition,0).lt(screenGridxposition,canvasHeight);
    }

    for (i=Math.floor(-maxVertGridNum/2); i<=Math.ceil(maxVertGridNum/2); i++)
    {
        screenGridyposition = canvasHeight/2 + screenGridSpacing*i;
        if (i%100===0)
            outerVertGrid.graphics.mt(0,screenGridyposition).lt(canvasWidth,screenGridyposition);
        else if (i%10===0)
            majorVertGrid.graphics.mt(0,screenGridyposition).lt(canvasWidth,screenGridyposition);
        else
            minorVertGrid.graphics.mt(0,screenGridyposition).lt(canvasWidth,screenGridyposition);
    }

    colorScaleFactor = 1-realMinGridSpacing/realGridSpacing;

    outerGridAlpha = 0.3;//+colorScaleFactor/10;
    majorGridAlpha = 0.1+colorScaleFactor/10;
    minorGridAlpha = 0.0+colorScaleFactor/10;

    minorHorizGrid.alpha = minorGridAlpha;
    minorVertGrid.alpha = minorGridAlpha;
    majorHorizGrid.alpha = majorGridAlpha;
    majorVertGrid.alpha = majorGridAlpha;
    outerHorizGrid.alpha = outerGridAlpha;
    outerVertGrid.alpha = outerGridAlpha;

}


function adjustGrid()
{
    realMinGridSpacing = minGridSpacing*positionScale;
    realGridSpacing = Math.pow(10, Math.ceil(log10(realMinGridSpacing+1)));
    screenGridSpacing = (realGridSpacing/positionScale);

    screenLeftPos = -screenx*positionScale;
    gridRealStartx = Math.floor(screenLeftPos/realGridSpacing/100)*100*realGridSpacing;
    gridScreenStartx = (gridRealStartx/positionScale) + screenx;

    colorScaleFactor = 1-realMinGridSpacing/realGridSpacing;

    outerGridAlpha = 0.3;//+colorScaleFactor/10;
    majorGridAlpha = 0.1+colorScaleFactor/10;
    minorGridAlpha = 0.0+colorScaleFactor/10;

    outerGridColor = "#fff";
    majorGridColor = "#fff";
    minorGridColor = "#fff";

    for (i=0; i<outerHorizGrid.length; i++)
    {
        id = outerHorizGrid[i].locid;
        screenGridxposition = gridScreenStartx + screenGridSpacing*id;
        outerHorizGrid[i].alpha = outerGridAlpha;
        outerHorizGrid[i].x = screenGridxposition;
    }
    for (i=0; i<majorHorizGrid.length; i++)
    {
        id = majorHorizGrid[i].locid;
        screenGridxposition = gridScreenStartx + screenGridSpacing*id;
        majorHorizGrid[i].alpha = majorGridAlpha;
        majorHorizGrid[i].x = screenGridxposition;
    }
    for (i=0; i<minorHorizGrid.length; i++)
    {
        id = minorHorizGrid[i].locid;
        screenGridxposition = gridScreenStartx + screenGridSpacing*id;
        minorHorizGrid[i].alpha = minorGridAlpha;
        minorHorizGrid[i].x = screenGridxposition;
    }

    for (i=0; i<outerVertGrid.length; i++)
    {
        id = outerVertGrid[i].locid;
        screenGridyposition = canvasHeight/2 + screenGridSpacing*id;
        outerVertGrid[i].alpha = outerGridAlpha;
        outerVertGrid[i].y = screenGridyposition;
    }
    for (i=0; i<majorVertGrid.length; i++)
    {
        id = majorVertGrid[i].locid;
        screenGridyposition = canvasHeight/2 + screenGridSpacing*id;
        majorVertGrid[i].alpha = majorGridAlpha;
        majorVertGrid[i].y = screenGridyposition;
    }
    for (i=0; i<minorVertGrid.length; i++)
    {
        id = minorVertGrid[i].locid;
        screenGridyposition = canvasHeight/2 + screenGridSpacing*id;
        minorVertGrid[i].alpha = minorGridAlpha;
        minorVertGrid[i].y = screenGridyposition;
    }

}



function handleProgress()
{
    loadingBar.scaleX = preload.progress * loadingBarWidth;

    progresPrecentage = Math.round(preload.progress*100);
    loadProgressLabel.text = "Loading... " + progresPrecentage + "%" ;

    stage.update();
}

function handleComplete()
{
    backgroundImage = preload.getResult("background");

    loadProgressLabel.text = "Click to begin";
    stage.update();

    canvas.addEventListener("click", handleLoadClick);
}


function handleLoadClick()
{
    stage.removeChild(loadProgressLabel, loadingBarContainer);
    canvas.removeEventListener("click", handleLoadClick);
    start();
}


function start()
{
    // background = new createjs.Bitmap(backgroundImage);
    // stage.addChild(background);

    generateSimplerGrid();
    adjustSimplerGrid();

    createBodies();
    generateBodyList();


    canvas.addEventListener("mousewheehttp://localhost/SolarSystem2013-12/SolarSystem/l", handleMouseWheel, false); // For IE > 9 and Chrome < 18
    canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false); // For Firefox
    canvas.onmousewheel = handleMouseWheel; // For Chrome > 18

    canvas.addEventListener("dblclick", handleDoubleClick);

    canvas.addEventListener("mousedown", handleMouseDown, false);
    canvas.addEventListener("mouseup", handleMouseUp, false);

    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;


    createjs.Ticker.addEventListener("tick", tick);
    createjs.Ticker.setFPS(framRateLimit);
    //updating the stage
    stage.update();
}

function getClosestObject(mouseX, positionScale, screenx)
{
    // newX = (this.center/positionScale)+screenx;
    clickPos = (mouseX - screenx);
    closest = bodies[0];
    minDistance = Math.abs(clickPos - bodies[0].center/positionScale);
    for (i=0; i < bodies.length; i++)
    {
        if (bodies[i].displayObject.visible)
        {
            thisDistance = Math.abs(clickPos - bodies[i].center/positionScale);
            if (thisDistance < minDistance)
            {
                closest = bodies[i];
                minDistance = thisDistance;
            }
        }
    }
    return closest;
}


function handleKeyDown(e) {
    if(!e){ var e = window.event; }
    targetScreenX = false;
    switch(e.keyCode) {
        case 39: // right arrow
        case 68: // D
            moveRight = true;
            break;
        case 37: // left arrow
        case 65: // A
            moveLeft = true;
            break;
        case 38: // up arrow
        case 87: // W
            zoomUp = true;
            break;
        case 40: // down arrow
        case 83: // S
            zoomDown = true;
            break;
    }
    return false;
}


function handleKeyUp(e) {
    if(!e){ var e = window.event; }
    targetScreenX = false;
    switch(e.keyCode) {
        case 39: // right arrow
        case 68: // D
            moveRight = false;
            break;
        case 37: // left arrow
        case 65: // A
            moveLeft = false;
            break;
        case 38: // up arrow
        case 87: // W
            zoomUp = false;
            break;
        case 40: // down arrow
        case 83: // S
            zoomDown = false;
            break;
        case 36: // Home key
            positionScale = startPositionScale;
            screenx = startScreenx;
            sizeScale = positionScale/sizeExaggeration;
            break;
    }
    return false;
}



function scrollToObjectNear(target, speed, threshold)
{
    thisBody = getClosestObject(target, positionScale, screenx);
    targetScreenX = -thisBody.center/positionScale + canvasWidth/2;
    autoScrollScale = Math.abs(targetScreenX-screenx);
    threshold = typeof threshold !== 'undefined' ? threshold : canvasWidth/2;
    if (autoScrollScale>threshold) targetScreenX = false;
    scrollSpeed = speed;

}



function handleDoubleClick(e)
{
    if(!e){ var e = window.event; }
    scrollToObjectNear(stage.mouseX, autoScrollSpeed);
}



function handleMouseDown(e)
{
    if(!e){ var e = window.event; }
    dragStartX = stage.mouseX;
    screenxStart = screenx;
    dragging = true;
}


function handleMouseDrag()
{
    if (Math.abs(stage.mouseX-dragStartX)>dragThreshold)
    {
        screenx = screenxStart + stage.mouseX-dragStartX;
    }
    if ((Math.abs(stage.mouseX-dragStartX)>canvasWidth || !stage.mouseInBounds))
    {
        dragging = false;
    }
}

function handleMouseUp(e)
{
    dragging = false;
    if (Math.abs(stage.mouseX-dragStartX)<dragThreshold)
    {
        thisshape = getClosestObject(stage.mouseX, positionScale, screenx);
        newDisplayBody = thisshape.shape.bodyID;
        if (newDisplayBody===displayBody)
        {
            // screenx = -thisBody.center/positionScale;
        }
        displayBody = newDisplayBody;
    }
}


function zoomIn()
{
    oldPositionScale = positionScale;
    positionScale = Math.ceil(positionScale/zoomSpeed);
    screenx = (screenx-canvasWidth/2)*(oldPositionScale/positionScale) + canvasWidth/2;
    sizeScale = positionScale/sizeExaggeration;

    scrollToObjectNear(canvasWidth/2, zoomScrollSpeed, 100);
}

function zoomOut()
{
    oldPositionScale = positionScale;
    positionScale = Math.ceil(positionScale*zoomSpeed);
    screenx = (screenx-canvasWidth/2)*(oldPositionScale/positionScale) + canvasWidth/2;
    sizeScale = positionScale/sizeExaggeration;
}

function handleMouseWheel(e)
{
    if(!e){ var e = window.event; }
    e.preventDefault();

    delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail))); // detail is for Firefox, wheelDelta is for other browsers.
    if (delta < 0) zoomOut();
    else if (delta > 0) zoomIn();

    return false;
}


function tick(event) {

    if (moveRight) screenx -= moveSpeed;
    if (moveLeft) screenx += moveSpeed;
    if (dragging) handleMouseDrag();
    if (zoomUp) zoomIn();
    if (zoomDown) zoomOut();
    adjustSimplerGrid();

    lastTime = thisTime;
    thisTime = createjs.Ticker.getTime(runTime = true);
    deltaTime = thisTime-lastTime;




    for (i=0; i<bodies.length; i++)
    {
        bodies[i].show(screenx, sizeScale, positionScale);
    }

    if (targetScreenX && Math.abs(targetScreenX - screenx) > 0.1)
    {
        thisScrollScale = (Math.abs(targetScreenX - screenx)/autoScrollScale)*0.667+0.333;
        thisScrollSpeed = Math.min(Math.abs(targetScreenX - screenx), scrollSpeed*deltaTime);
        if (targetScreenX > screenx) screenx += thisScrollSpeed*thisScrollScale;
        else screenx -= thisScrollSpeed*thisScrollScale;
    }
    else targetScreenX = false;

    updateDisplay++;
    if (updateDisplay > updateDisplayFrequency)
    {
        displayUpdate();
        updateDisplay = 0;
    }


    stage.update(event);

}


function displayUpdate()
{
    if (!bodies[displayBody].name) displayBody=0;
    $("#screenpos").text(screenx);
    //if (bodies[displayBody].parent)
        $("#note").text(getDescription(bodies[displayBody].name));
    $("#name").text(bodies[displayBody].name);
    $("#posx").text(bodies[displayBody].shape.x);
    $("#posy").text(bodies[displayBody].shape.y);
    $("#width").text(bodies[displayBody].screenSizeX);
    $("#height").text(bodies[displayBody].screenSizeY);
    $("#posscale").text(numberWithCommas(positionScale));
    $("#fps").text(' ('+Math.round(createjs.Ticker.getMeasuredFPS()*100)/100+' fps)');

}


function getDescription(name)
{
    switch(name)
    {
        case "The Sun":
            return "The sun is our very own star at the center of our solar system. \n\
                    It's a big burning ball made up of mainly hydrogen and helium. It was once \n\
                    thought to be pretty average, but we now know that the Sun is in the top 15% brightest \n\
                    stars in the Milky Way Galaxy.";

        case "Mercury":
            return "Mercury is the smallest of the eight major planets. Because of an unusual resonance between \n\
                    Mercurian days and years, a person standing on Mercury would have to wait two years after sunrise \n\
                    to see the sun set. There are also two points on Mercury where one can watch the sun take an S-shaped \n\
                    path across the sky. Unlike our sky, the sky on Mercury is almost black during the day, as there is\n\
                    virtually no atmosphere.";


        case "Venus":
            return "Venus is very similar in size to earth, and may once have had oceans just like ours. However, its \n\
                    atmosphere is 96% darbon dioxide, a greenhouse gas which traps heat in. The surface temperature of \n\
                    460°C (863°F) would have vapourised any oceans long ago. Now, it has an atmospheric pressure more  \n\
                    than 90 times that of Earth, and its surface is obscured by thick clouds of sulfuric acid, which \n\
                    make it a very difficult planet to visit. Because it is closer to the sun than the Earth, it is only \n\
                    ever visible in the morning or evening, and is never visible in the middle of the night.";


        case "Earth":
            return "The Earth is the largest of the four terrestrial planets. More than 70% of the surface is surface is \n\
                    covered with oceans of liquid water. It has active plate tectonics, which shift land masses around \n\
                    over several millions of years. So far, it is the only planet on which we have confirmed the existance \n\
                    of life.";
        case "The Moon":
            return "The Moon is the only natural satellite of the Earth, and so far, the only other body upon which humans have\n\
                    set foot. Like many moons, it is tidally locked to the Earth. This means that observers on Earth will only ever\n\
                    be able to see one half of the Moon's surface. It is mainly made up of rock, but there are traces of ice in some \n\
                    craters near the poles. It is responsible for tides.";


        case "Mars":
            return "Also known as the \"Red Planet\", Mars gets its colour from the high quantities of iron oxide on it's surface.\n\
                    It has a thin atmosphere, and days and seasonal cycles very similar to those on Earth. On the surface, Mars looks \n\
                    similar to a rocky desert on Earth, except for at the poles which are covered by ice caps. Evidence suggests that \n\
                    Mars may have been capable of supporting simple life during the Solar System's early years, leading to an ongoing \n\
                    search to see whether or not living organisms ever did exist there.";
        case "Phobos":
            return "Phobos is a captured asteroid that orbits Mars every 7 hours. Because of this, it rises in the west and sets in \n\
                    the east twice each Martian day. It is plummeting toward Mars at a rate of 1 metre every 100 years, and will most\n\
                    probably collide with Mars or break up into a planetary ring within the next 50 million or so years.";
        case "Deimos":
            return "Deimos is a captured asteroid less than 15 km across. From the surface of Mars, it is about one twelfth of the \n\
                    width of The Moon seen from Earth, and looks almost like just another star. At its brightest, it is about as bright \n\
                    as Venus appears from Earth.";


        case "Ceres":
            return "Ceres is the only dwarf planet in the inner solar system and makes up one third of the asteroid belt's mass. Discovered \n\
                    in 1801, it was widely considered to be a planet for almost half a century, but turned out to be the first in a class of\n\
                    many similar objects, later termed asteroids. In 2006, the debate about Pluto's status led to Ceres being classified as a \n\
                    dwarf planet. It fails to meet the criteria for a major planet, because it has not cleared the neighbourhood around its orbit.";
        case "Asteroid Belt":
            return "Contrary to popular belief, asteroids in the asteroid belt are very far apart, making it fairly easy to traverse it \n\
                    without any collisions. There are around a million asteroids with a diameter of more than a kilometre, but these are usually \n\
                    tens of thousands of kilometres apart. Of all the meteorites \n\
                    that have been found on Earth, 99.8% are believed to have originated in the asteroid belt.";


        case "Jupiter":
            return "Jupiter is the largest planet in the solar system, and has a mass two and a half times greater than all of the other planets \n\
                    combined. It's atmosphere is about three quarters hydrogen and one quarter helium - which is very similar to that of the sun.\n\
                    Jupiter generates more heat than it recieves from the sun, and is similar in size to a brown dwarf star. However, Jupiter is \n\
                    classified as a planet and not a star, as it is not heavy enough to be able to fuse deuterium. Jupiter has at least 67 moons, \n\
                    but just four of them make up 99.999% of the total mass orbiting Jupiter. It has a faint system of rings, but because these are \n\
                    mostly made of very fine dust, they are invisible to all but the most powerful Earth-based telescopes.";
        case "Io":
            return "Io is highly volcanic ball of molten iron. The immense tidal forces from Jupiter make it the most geologically active object in \n\
                    the solar system. It's bright yellow colour comes from the vast sulfur coated plains, which are speckled\n\
                    with dark spots caused by erupting volcanoes, and white fields of volcanically deposited sulphur dioxide frost. There are \n\
                    rivers of lava which can flow for hundreds of kilometres across the surface, and the volcanoes can blast ash hundreds of kilometres \n\
                    into space, which leaves a ring of ionized particles along Io's orbit around Jupiter.";
        case "Europa":
            return "Europa is similar in size to Earth's moon. It has a thin atmosphere of oxygen, and is covered with extremely smooth ice, crossed with long \n\
                    straight cracks. This, and the scarcity of craters, means that there are probably huge oceans of liquid water underneath. \n\
                    Although no sunlight would reach these oceans, other sources of heat such as tidal forces and chemical reactions could conceivably\n\
                    provide an energy source for life in Europa's oceans, much like microbial life around the hydrothermal vents in Earth's deep oceans.";
        case "Ganymede":
            return "Ganymede is the largest moon in the solar system, and is even larger than the planet Mercury. It is made up of rock and ice, and may have a\n\
                    saltwater ocean 200km below its surface. It's surface is covered with many old impact craters. It has a magnetic field of it's own, and is \n\
                    the only known moon to do so. This implies that it has a core of moving liquid iron, but the reason why this core has not yet cooled and solidified \n\
                    as in similar sized bodies remains unknown.";
        case "Callisto":
            return "Callisto's surface is static - there are no signs of volcanoes or plate tectonics or anything else under the surface. It is heavily cratered.\n\
                    It has about one eigth of Earth's gravity, and has been considered as a suitable location for a base for future human exploration of Jupiter's \n\
                    other moons, or as a waystation servicing space craft heading further into the outer solar system. It's far enough from Jupiter that it \n\
                    doesn't get to much radiation, but close enough that Jupiter could be used for a gravitational assist.";


        case "Saturn":
            return "The outer atmosphere of Saturn is generally bland, except for a few global storms which occure roughly every 30 or so Earth years.\n\
                    There is a massive vortex at the north pole, which is surrounded by a mysterious hexagonal wave pattern that is 13,800 km across. \n\
                    All of our gas giants have rings, but Saturn's are mostly made up of highly reflective ice chunks ranging in size from the size of dust \n\
                    particles to a few metres across. This makes them by far the most easily visible rings in our solar system, and they are easily visible\n\
                    from Earth with any decent telescope.";
        case "Mimas":
            return "Mimas is the smallest body that we know of that stays round due to its own gravity, although it is slightly squashed. It's most noticable\n\
                    feature is the Herschel impact crater, which has a diameter almost a third of Mimas's own diameter, with walls over 5 km high. Fractures\n\
                    from this impact are visible on the opposite side of Mimas. When Mimas was first imaged by Voyager 1 in 1980, it's close resemblance to the\n\
                    Death Star from Star Wars Episode IV, released three years before, was immediately apparent.";
        case "Enceladus":
            return "Enceladus is covered in highly reflective ice, and cryovolcanoes (also called ice volcanoes) shoot jets of water vapour out into space. Some of this falls \n\
                    back on Enceladus as snow, but a lot of it falls toward Saturn, and is believed to be the source of Saturn's E ring. It has a resonance with\n\
                    Dione, which provides a heat source for it's geological activity. Enceladus is believed to be one of the most habitable locations outside \n\
                    of Earth for life as we know it.";
        case "Tethys":
            return "Tethys is made up almost entirely of ice, with traces of some unidentified dark material. It's leading hemisphere is slightly brighter with a \n\
                    bluish band across the center, caused by ice particles deposited as it moves through Saturn's E ring. The trailing hemisphere is darker due to bombardment\n\
                    by plasma from Saturn's magnetosphere. Tethys shares its orbit with two smaller moons - Telesto and Calypso which are each a thirtieth of the size \n\
                    of Tethys, and remain 60° ahead and behind Tethys respectively.";
        case "Dione":
            return "Dione has a uniformly bright leading hemisphere which is heavily cratered. The trailing hemisphere is covered by bright straight lines that \n\
                    were once referred to as \"wispy terrain\". The lines are very thin, and do not seam to obscure features undereath. A close flyby by the Cassini\n\
                    orbiter showed that these were sharp cliffs of ice several hundred metres high that were likely created by tectonic fractures in Dione's past. ";
        case "Rhea":
            return "Rhea is Saturn's second largest moon. At one stage, Rhea was thought to have a ring system of its own, but close observation by the Cassini\n\
                    orbiter failed to find any evidence of ring material. It has a similar features and discoloration to Dione, suggesting a very similar history. \n\
                    It's interior is most probably uniform, consisting\n\
                    of roughly 75% ice and 25% rock. ";
        case "Titan":
            return "Titan makes up 96% of the mass orbiting Saturn, and is the second largest moon in the solar system, and the only moon known to have a dense atmosphere. Its atmoshere is 98% nitrogen, but a\n\
                    thick yellow smog of hydrocarbons completely obscure the surface. The Huygens probe landed on Titan in January 2005, making Titan the most distant body from Earth, and\n\
                    the only moon other than our own, on which we have landed a probe. The surface of Titan is similar to Earth's, but at a much lower temperature. There\n\
                    are lakes and seas of liquid methane and ethane on the surface, and is geologically active with cryovolcanoes ejecting hydrocarbon vapour into the atmosphere. It has been speculated that\n\
                    Titan provides the necessary conditions for life like on Earth, but using a methane cycle instead of a water cycle. No evidence of life has been found,\n\
                    but Titan shows evidence of a prebiotic environment rich in complex organic chemistry.";
        case "Iapetus":
            return "When Cassini discovered Iapetus in 1671, he was puzzled that he could only see it on the western side of Saturn, but could never see it\n\
                    on Saturn's eastern side when it was supposed to be there. It took him 34 years, and a much more powerful telescope before he saw Iapetus on the \n\
                    eastern side. It turns out that bright white trailing hemisphere of Iapetus is about six times brighter than the dark brown leading hemisphere. \n\
                    The contrast between the light and dark regions is obvious, even on a scale down to a few dozen metres. There is also an unexplained 13km high ridge running\n\
                    around a large portion of Iapetus's equator.";


        case "Uranus":
            return "Uranus is covered in a thick layer of methane clouds, and looks like featureless cyan ball. For some reason, Uranus is lying on\n\
                    its side, which means it's poles are located where most planets have their equators. This gives Uranus seasonal changes that are\n\
                    unique in the solar system. \n\
                    Uranus has a system of thin rings that are mostly less than a few kilometres thick, which are made up almost entirely of chunks. \n\
                    of ice. The rings are much younger than the rings of the other gas giants, and were probably formed about 600 million years \n\
                    ago when some moons collided. In the center, there is a tiny core of rocky iron, which is covered by a thick water-ammonia\n\
                    ocean. Some researches believe that there may be oceans of liquid diamond floating on the surface due to the incredibly high\n\
                    temperatures and pressures.";
        case "Miranda":
            return "Miranda is a ball of fractured ice. It's surface is crossed by several long canyons, which were probably formed by violent geological\n\
                    activity caused by tidal heating. Miranda was once in resonance with Umbriel and Ariel, but has since escaped. This would have\n\
                    led to tidal forces of a much higher magnitude in Miranda's past.";
        case "Ariel":
            return "Ariel has a core of rock surrounded by a mantle of ice. Its surface is heavily cratered, but does show signs of recent geological\n\
                    activity. It is slightly reddish grey in colour. The only substances confirmed to exist on it's surface are water ice and carbon \n\
                    dioxide.";
        case "Umbriel":
            return "Umbrial is the darkest of Uranus's moons, and is very heavily cratered. It surface is patched by a polygons which may have been formed by\n\
                    tectonic activity when the moon was still very young. Umbriel seems to be coated with some dark \n\
                    material, and the brighter surface underneath is visible in the rings and central peaks of some craters.";
        case "Titania":
            return "Titania may have an atmosphere of carbon dioxide a billion times thinner than ours on Earth. Parts of its surface appear to be\n\
                    smooth, suggesting fairly recent cryovolcano activity. A 1500 km long canyon runs from the equator to south pole. This, and other \n\
                    large canyons on Titania's surface were possible caused when Titania expanded by just under a percent at some point in its history.";
        case "Oberon":
            return "Oberon is the reddest and second darkest of Uranus's moons, and like most of Uranus's moons, consists of roughly equal parts rock and ice.\n\
                    It surface is the most heavily cratered of all of Uranus's moons, but also has a system of cracks from a global expansion in its\n\
                    early history. Oberon spends some of its orbit outside of Uranus's magnetosphere, and thus is exposed directly to the solar wind.";


        case "Neptune":
            return "Neptune was the first planet to be discovered using mathematical prediction rather than direct observation. It has \n\
                    14 moons, but the largest (Triton) is 400 times more massive than the second largest. Neptune's surface is obscured by a deep blue cloud\n\
                    deck, but white bands of high altitude clouds are often visible high above this, often casting shadows on the blue cloud \n\
                    below. Severe storms lasting several months regularly form dark holes in the lower cloud deck. These storms drive winds which \n\
                    can reach nearly supersonic speeds. Neptune's south pole has recently recieved 40 years of direct sunlight, which has caused a\n\
                    methane to leak out into space in this region. This may cause diamonds to form in the atmosphere, which would then rain down on the\n\
                    surface.";
        case "Triton":
            return "Triton's orbit is in the opposite direction to Neptune, and is the only large moon in the solar system for which this is the case.\n\
                    Triton probably started out as a dwark planet in the Kuiper belt, which was captured by Neptune's gravitational pull. Triton is nearly\n\
                    identical in composition to, and slightly larger than Pluto. Triton is geologically active, with geysers spraying nitrogen and cryovolcanoes \n\
                    erupting water and ammonia into Triton's thin atmosphere. This causes the surface to be renewed over periods of just tens of millions of years.\n\
                    The atmosphere is just dense enough for thin clouds of condensed nitrogen to form a couple of kilometres above the surface.";


        case "Pluto":
            return "Pluto was discovered in 1930, and for a long time was considered the ninth planet from the sun. However, the discovery of several \n\
                    similar objects orbiting the sun since 1977 triggered a debate over what constitutes a planet. After the discovery of Eris \n\
                    (which is 27% more massive than Pluto), Pluto was classified as a dwarf planet, along with four other bodies. It is estimated \n\
                    that there may be as many as ten thousand dwarf planets in our solar system.";
        case "Charon":
            return "Charon is just over half the size of Pluto, and the two orbit about a point that lies above the surface of Pluto. \n\
                    This has lead to some astronomers referring to it as a binary planet. The two are tidally locked to eachother, \n\
                    meaning that whichever one you are standing on, the other will always remain in the same point in the sky.";


        case "Haumea":
            return "Although few bodies in space are truly spherical, Haumea's ellipsoid shape is extreme. The distance from pole to pole on Haumea is about\n\
                    half its maximum dimension at the equator. Haumea is extremely bright - its crystalline ice surface is about as reflective as snow.\n\
                    Carbon-rich molecules such as methane appear to be absent over most of the surface, with the exception of one region discovered in 2009,\n\
                    which is beleived to be an impact crater.";
        case "Namaka":
            return "Not much is known about Namaka. Measurements suggest that its surface is covered in ice. If that is so, then it is probably about 170km\n\
                    in diameter. It reflects just on seventieth of the light of Haumea.";
        case "Hi'iaka":
            return "Hi'iaka roughly a quarter of the size of Haumea. It is probably large enough to be rounded under its own gravitation, but has not \n\
                    been imaged at a sufficiently high resolution to determine wether or not this is the case. \n\
                    It's surface is covered in crystalline ice, which is puzzling, since crystalline ice usually forms at warmer temperatures,\n\
                    and Hi'iaka's constant\n\
                    exposure to cosmic radiation should have broken the crystals down.";


        case "Makemake":
            return "Makemake appears to have no natural moons, which makes it unique amongst large Kuiper belt objects. Its surface is covered with frozen methane,\n\
                    ethane and nitrogen. Makemake is the second brightest Kuiper belt object after Pluto, and is just bright enough to be visible\n\
                    with a high-end amateur telescope. It appears that Makemake has an no atmosphere at the moment, but some of the nitrogen on the surface\n\
                    may defrost as its orbit brings it closer to the sun. However, Makemake's weak gravity is not strong enough to hold onto its atmosphere\n\
                    as it moves further out into space again.";


        case "Eris":
            return "Eris is the largest known dwarf planet. After its discovery, NASA briefly refered to Eris as the \"tenth planet\", which led to the \n\
                    lead to the term 'planet' being defined for the first time the following year. Like most of the scattered disc objects, Eris's \n\
                    orbit is highly inclined and eccentric, which is\n\
                    possibly why it managed to evade discovery until recently. At the moment, it is close to it's furthest point from the sun, which is about\n\
                    2.5 times further out than it's closest point, which it will reach in about 2256. In about 800 years time, Eris will be closer to the sun \n\
                    than Pluto for a short time. Eris has a surface of methane ice, which suggests that either it is cold enough that the methane doesn't\n\
                    defrost as it approaches the sun, or that there is some internal source of methane which repleneshes the surface.";
        case "Dysnomia":
            return "Dysnomia appears to be much darker and redder in colour than Eris. Little is known about the moon itself, but Dysnomia's orbit has been used\n\
                    to accurately calculate the mass of Eris. ";


        case "Kuiper Belt":
            return "The Kuiper belt is a donut shaped region beyond the orbit of Neptune, which contains a number asteroids, as well as at least three dwarf planets.\n\
                    It is about 200 times more massive than the asteroid belt. Most objects in the Kuiper belt are made of ices, \n\
                    but there are also several consisting of rock\n\
                    and metal.After it's discovery in 1992, the Kuiper belt was believed to be\n\
                    the source of some comets. However, studies have since shown that most objects in the Kuiper belt have stable orbits, and the comets\n\
                    likely originate in the scattered disc. The orbits are stable either because they are too far out to be affected by Neptune (in which case, they\n\
                    referred to as classical Kuiper belt objects), or a resonance with Neptunes orbit prevents Neptune from clearing them from it's orbit.\n\
                    (refered to as resonant Kuiper belt objects).\n\
 ";
        case "Scattered Disc":
            return "Scattered disc objects are objects with eccentric and highly inclined orbits that have been scattered (or are being scattered) to the far reaches of the solar system\n\
                    by the gas giants, usually Neptune. By definition, objects in the scattered disc have unstable orbits, and many of them land up as comets on orbits into\n\
                    the inner solar system. During the early years of the solar system, Neptune may have had a temporarily chaotic orbit in the early\n\
                    years of the solar system before settling into its current orbit, and this may have sent many objects in the Kuiper belt into the\n\
                    scattered orbits that they follow today. The scattered disc is likely the source of many short period comets. \n\
                    ";

        case "Oort Cloud":
            return "The Oort cloud is a hypothetical spherical cloud made of chuncks of ice about a lightyear from the sun.  The Oort cloud \n\
                    is thought to be the source of all long period comets.\n\
                    The outer limit of the Oort cloud is the edge of the Sun's gravitational influence, and objects in the Oort cloud would be\n\
                    only loosly bound by the sun's gravity. Passing stars, or even the Milky Way galaxy itself would disturb the orbits of objects\n\
                    in the Oort cloud, and send them into the inner solar system, or out into space. Currently, only four objects are considered possible members\n\
                    of the Oort cloud. Most notable is the dwarf planet candidate Sedna, which seems to take about 11,400 years to orbit the sun, \n\
                    and at it's furthest point, gets about a thousnd times further from the sun than the Earth. \n\
                     ";


        case "Proxima Centauri":
            return "Although it's the nearest star to us, it is not visible with the naked eye. Proxima Centauri is a red dwarf with a diameter about\n\
                    one seventh of our sun, and even viewed from Alpha Centauri A, it would appear unremarkable. Searches for planets around Proxima Centauri have not revealed any, which rules out the possibility of gas\n\
                    giants or large rocky planets. Proxima Centauri will gradually brighten and change colour from red to blue as it ages, eventually\n\
                    becoming a white dwarf. However, this process is expected to take trillions of years - hundreds of times longer than the expected life span of our own sun.\n\
                    Proxima Centauri is probably part of a triple star system with Alpha Centauri A and B, but it has not yet been determined whether or not it is actually\n\
                    in orbit or just passing by.";
        case "Alpha Centauri A":
            return "Alpha Centauri A is the larger of the two stars that make up the Alpha Centauri system. It is about 10% more massive than our own sun,\n\
                    and 20% more massive than it's companion star. From Earth, Alpha Centauri A and B together appear as a single star in the sky - Rigel Kent, which is\n\
                    the brighter of the two pointers for the Southern Cross.";
        case "Alpha Centauri B":
            return "Alpha Centauri B was identified in 1689, and is very similar to our sun, weighing just 10% less. It orbits its companion at a distance that varies between \n\
                    just further than Saturn orbits our Sun, and the distance from our sun to Pluto.\n\
                    The two stars take about 80 years to complete a single revolution. It is slightly oranger in colour than Alpha Centauri A or our Sun.";
        case "Alpha Centauri Bb":
            return "There is still some debate about whether or not the planet actual does exist, but applying statistical filters to some measurements of \n\
                    Alpha Centauri B's radial velocity suggests that there may be at least one planet orbiting Alpha centauri B. \n\
                    If it exists, the planet has a mass slightly higher than Earth, but orbits at a distance of just\n\
                    one tenth of Mercury from our own Sun. It is likely to have a surface temperature of around 1200°C, which means, if the planet is a rocky\n\
                    planet, then it would have a surface of lava. ";

    }
    return "";

}