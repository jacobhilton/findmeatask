(function($,window,document,undefined){

  var visualization={
    "loaded":false,
    "onceloaded":function(callback){
      if(visualization.loaded){
        callback();
      }
      else{
        google.setOnLoadCallback(callback);
      }
    }
  };
  google.load("visualization","1",{packages:["table"]});
  google.setOnLoadCallback(function(){
    visualization.loaded=true;
  });

  $(function(){

    var trello={
      "board":"wv8ER0TG",
      "key":"faab2f052ae86401cc0a5ce54ae2e3bb"
    };

    var timefromstring=function(string){
      string=string.split(" ");
      if(string.length!=2){
        return null;
      }
      string[0]=string[0]*1;
      if(isNaN(string[0])){
        return null;
      }
      string[1]=string[1].toLowerCase();
      string[1]={
        "s":1,
        "sec":1,
        "secs":1,
        "second":1,
        "seconds":1,
        "m":60,
        "min":60,
        "mins":60,
        "minutes":60,
        "h":60*60,
        "hr":60*60,
        "hrs":60*60,
        "hour":60*60,
        "hours":60*60,
        "d":60*60*24,
        "day":60*60*24,
        "days":60*60*24
      }[string[1]];
      if(!(string[1]>0)){
        return null;
      }
      return string[0]*string[1];
    };

    var getlists=function(callback){
      $.getJSON("https://api.trello.com/1/boards/"+trello.board+"/lists?key="+trello.key,function(data){
        var lists={};
        for(var listnumber=0;listnumber<data.length;listnumber++){
          lists[data[listnumber].id]=data[listnumber].name;
        }
        callback(lists);
      });
    };

    var getcards=function(callback){
      getlists(function(lists){
        $.getJSON("https://api.trello.com/1/boards/"+trello.board+"/cards?key="+trello.key,function(data){
          var cards=[];
          for(var cardnumber=0;cardnumber<data.length;cardnumber++){
            var labels=[];
            var mintime="not specified";
            var maxtime="not specified";
            var minseconds=0;
            var maxseconds=60*60*24*365
            for(var labelnumber=0;labelnumber<data[cardnumber].labels.length;labelnumber++){
              var label=data[cardnumber].labels[labelnumber].name;
              if(label.toLowerCase().indexOf("from ")==0){
                var fromtime=label.substr(5);
                var fromseconds=timefromstring(fromtime);
                if(fromseconds!==null&&fromseconds>minseconds){
                  mintime=fromtime;
                  minseconds=fromseconds;
                }
              }
              else if(label.toLowerCase().indexOf("to ")==0){
                var totime=label.substr(3);
                var toseconds=timefromstring(totime);
                if(toseconds!==null&&toseconds<maxseconds){
                  maxtime=totime;
                  maxseconds=toseconds;
                }
              }
              else{
                labels.push(label);
              }
            }
            var list=lists[data[cardnumber].idList];
            cards.push({
              "name":data[cardnumber].name,
              "description":data[cardnumber].desc,
              "url":data[cardnumber].url,
              "minseconds":minseconds,
              "maxseconds":maxseconds,
              "mintime":mintime,
              "maxtime":maxtime,
              "labels":labels,
              "list":list
            });
          }
          callback(cards);
        });
      });
    };

    var allcards=[];
    getcards(function(cards){
      allcards=cards;
      init();
    });

    var getapplicablecards=function(seconds,callback){
      var cards=[];
      for(var i=0;i<allcards.length;i++){
        var card=allcards[i];
        if(card.minseconds<=seconds&&seconds<=card.maxseconds&&card.mintime!="not specified"&&card.maxtime!="not specified"&&($.inArray(card.list,categories.excluded)==-1)){
          cards.push(card);
        }
      }
      callback(cards);
    };

    var shufflearray=function(unshuffledarray){
      var shuffledarray=[];
      while(unshuffledarray.length>0){
        shuffledarray.push(unshuffledarray.splice(Math.floor(Math.random()*unshuffledarray.length),1)[0]);
      }
      return shuffledarray;
    };

    var timer={
      "title":document.title,
      "interval":false,
      "secondsleft":0,
      "lastseconds":0,
      "timetostring":function(seconds){
        var addzeros=function(number){
          if(number<10){
            number="0"+number;
          }
          return number;
        };
        var date=new Date();
        date.setTime(seconds*1000);
        return (seconds<60*60?"":addzeros(date.getHours())+":")+addzeros(date.getMinutes())+":"+addzeros(date.getSeconds());
      },
      "update":function(){
        if(timer.secondsleft==0){
          timer.stop();
          $("#timer").hide();
          $("#feedback").show();
          alert("Time is up!");
        }
        else{
          var string=timer.timetostring(timer.secondsleft);
          document.title=string+" "+timer.title;
          timer.displayspan.text("Time remaining: "+string);
          timer.secondsleft--;
        }
      },
      "init":function(seconds){
        timer.lastseconds=seconds;
        timer.stop();
        $("#timer").show().append($("<button></button>").text("Start timer").click((function(seconds){
          return function(event){
            timer.start(seconds);
          };
        })(seconds)));
      },
      "start":function(seconds){
        timer.secondsleft=seconds;
        timer.displayspan=$("<span></span>");
        $("#timer").empty().append(timer.displayspan,$("<br>"),$("<button></button>").text("Stop timer early").click((function(seconds){
          return function(event){
            timer.interrupt();
          };
        })(seconds)));
        timer.update();
        timer.interval=window.setInterval(timer.update,1000);
      },
      "interrupt":function(){
        timer.lastseconds-=timer.secondsleft;
        timer.secondsleft=0; 
        timer.stop();
        $("#timer").hide();
        $("#feedback").show();
      },
      "stop":function(){
        if(timer.interval){
          window.clearInterval(timer.interval);
          timer.interval=false;
        }
        document.title=timer.title;
        $("#timer").empty();
        $("#feedback").hide();
      }
    };

    var categories={
      "excluded":$.parseJSON($.cookie("excludedcategories")||"[]"),
      "checkboxes":{},
      "updateexcluded":function(){
        categories.excluded=[];
        $.each(categories.checkboxes,function(name,checkbox){
          if(!checkbox.prop("checked")){
            categories.excluded.push(name);
          }
        });
        $.cookie("excludedcategories",JSON.stringify(categories.excluded));
      },
      "init":function(lists){
        $.each(lists,function(index,name){
          categories.checkboxes[name]=$("<input type=\"checkbox\">").prop("checked",$.inArray(name,categories.excluded)==-1).change(categories.updateexcluded);
          $("#categories").append($("<br>"),$("<label></label>").append(categories.checkboxes[name],document.createTextNode(" "+name)));
        });
      }
    };

    var points={
      "actionvalues":{
        "tasklow":1,
        "taskmedium":2,
        "taskhigh":3
      },
      "log":$.parseJSON($.cookie("pointslog")||"[]"),
      "addtolog":function(action,multiplier){
        alert("Congratulations! Here's "+points.actionvalues[action]*multiplier+" points.");
        points.log.push([action,multiplier,(new Date()).getTime()]);
        $.cookie("pointslog",JSON.stringify(points.log));
        points.updatedisplay();
      },
      "updatedisplay":function(){
        var totalpoints=0;
        $.each(points.log,function(index,logitem){
          totalpoints+=points.actionvalues[logitem[0]]*logitem[1];
        });
        $("#points").text("Total points: "+totalpoints);
      }
    };

    var displaycard=function(card){
      var description=card.description.split("\n");
      var descriptionp=$("<p></p>");
      $.each(description,function(index,line){
        descriptionp.append(document.createTextNode(line));
        if(index<description.length-1){
          descriptionp.append($("<br>"));
        }
      });
      descriptionp.linkify();
      var listb=$("<b></b>").text(card.list);
      var mintimeb=$("<b></b>").text(card.mintime);
      var maxtimeb=$("<b></b>").text(card.maxtime);
      $("#result")
        .empty()
        .append($("<h2></h2>").text(card.name))
        .append(descriptionp)
        .append($("<p></p>")
          .append(document.createTextNode("This "))
          .append(listb)
          .append(document.createTextNode(" should take from "))
          .append(mintimeb)
          .append(document.createTextNode(" to "))
          .append(maxtimeb)
          .append(document.createTextNode("."))
        )
        ;//.append($("<p></p>").append($("<a></a>").attr("href",card.url).text("Trello card")));
    };

    var cachedcards={};

    var freefortime=function(seconds){
      return function(event){
        timer.stop();
        $("#result").empty().append($("<p></p>").css({"text-align":"center"}).text("Loading..."));
        $("#showapplicablecards").show();
        getapplicablecards(seconds,function(cards){
          if(cardtables.showingapplicable){
            visualization.onceloaded(function(){
              cardtables.display(cards,"applicablecardstable");
            });
          }
          if(cachedcards.hasOwnProperty(seconds)&&cachedcards[seconds].length>0){
            card=cachedcards[seconds].splice(0,1)[0];
            timer.init(seconds);
            displaycard(card);
          }
          else{
            if(cards.length==0){
              $("#result").empty().append($("<p></p>").css({"text-align":"center"}).text("No tasks found."));
            }
            else{
              cards=shufflearray(cards);
              card=cards.splice(0,1)[0];
              cachedcards[seconds]=cards;
              timer.init(seconds);
              displaycard(card);
              $("#timesubmit").val("Find me a different task instead");
            }
          }
        });
      };
    };

    var init=function(){
      $("#loadingscreen").hide();
      $("#container").show();
      $.cookie.defaults.expires=365;
      $("#categories").hide();
      $("#showpreferencesbutton").click(function(event){
        event.preventDefault();
        $("#showpreferences").hide();
        $("#categories").show();
      });
      getlists(function(lists){
        categories.init(lists);
      });
      points.updatedisplay();
      $("#timeform").hide().submit(function(event){
        event.preventDefault();
        $("#timebuttons").hide();
        $("#timeform").show();
        freefortime($("#timeamount").val()*$("#timeunit").val())(event);
      });
      $("#feedback").hide();
      $.each(["2 minutes","5 minutes","10 minutes","15 minutes","20 minutes","25 minutes","30 minutes","45 minutes","1 hour","Other"],function(index,freetime){
        if(freetime!="Other"){
          $("#timebuttons").append($("<button></button>").text(freetime).click((function(freetime,freeseconds){
            return function(event){
              $("#timebuttons").hide();
              $("#timeform").show();
              $("#timeamount").val(freetime.split(" ")[0]);
              $("#timeunit").val(timefromstring("1 "+freetime.split(" ")[1]));
              freefortime(freeseconds)(event);
            };
          })(freetime,timefromstring(freetime))),$("<br>"));
        }
        else{
          $("#timebuttons").append($("<button></button>").text(freetime).click(function(event){
            $("#timebuttons").hide();
            $("#timeform").show();
            $("#timeamount").focus();
          }));
        }
      });
      $.each(["low","medium","high"],function(index,rating){
        $("#feedback"+rating).click(function(event){
          points.addtolog("task"+rating,timer.lastseconds);
          $("#feedback").hide();
        });
      });
      $("#widecontainer").show();
      $("#showallcardsbutton").click(function(){
        event.preventDefault();
        $("#showallcards").hide();
        $("#allcardsheader").show();
        $("#allcardstable").show();
        visualization.onceloaded(function(){
          cardtables.display(allcards,"allcardstable");
          cardtables.scrollto($("#allcardstable"));
        });
      });
      $("#showapplicablecardsbutton").click(function(){
        event.preventDefault();
        $("#applicablecardstable").show();
        cardtables.showingapplicable=true;
        getapplicablecards($("#timeamount").val()*$("#timeunit").val(),function(cards){
          visualization.onceloaded(function(){
            cardtables.display(cards,"applicablecardstable");
            cardtables.scrollto($("#applicablecardstable"));
          });
        });
      });
    };

    var cardtables={
      "display":function(cards,divid){
        cards=$.extend(true,[],cards);
        cards.sort(function(a,b){if(a.title<b.title){return -1;}else if(a.title>b.title){return 1;}else{return 0;}});
        var data=new google.visualization.DataTable();
        data.addColumn("string","Title");
        data.addColumn("string","Minimum time (use seconds to sort)");
        data.addColumn("string","Maximum time (use seconds to sort)");
        data.addColumn("number","Minimum time (seconds)");
        data.addColumn("number","Maximum time (seconds)");
        data.addColumn("number","Average");
        data.addColumn("string","Category");
        data.addColumn("string","Labels");
        data.addColumn("string","Full description");
        //data.addColumn("string","Trello card URL");
        var rows=[];
        for(var i=0;i<cards.length;i++){
          rows[i]=[cards[i].name,cards[i].mintime,cards[i].maxtime,cards[i].minseconds,cards[i].maxseconds,(cards[i].minseconds+cards[i].maxseconds)/2,cards[i].list,cards[i].labels.join(", "),"(hover to view / click to select)"];//,cards[i]["url"]];
        }
        data.addRows(rows);
        var randomclass="task"+Math.random().toString().split(".")[1]+"number";
        for(var i=0;i<cards.length;i++){
          data.setProperty(i,8,"className",randomclass+i);
        }
        var table=new google.visualization.Table(document.getElementById(divid));
        table.draw(data);
        var enhance=(function(cards,divid,randomclass){
          return function(){
            //$("#"+divid).linkify();
            for(var i=0;i<cards.length;i++){
              $("."+randomclass+i).prop("title",cards[i].description).click((function(card){
                return function(){
                  timer.init(card.minseconds<=timer.lastseconds&&timer.lastseconds<=card.maxseconds?timer.lastseconds:(card.minseconds+card.maxseconds)/2);
                  displaycard(card);
                  cardtables.scrollto($("#result"));
                }
              })(cards[i]));
            }
          };
        })(cards,divid,randomclass);
        enhance();
        google.visualization.events.addListener(table,"sort",enhance);
      },
      "showingapplicable":false,
      "scrollto":function(place){
        $("html,body").animate({
          "scrollTop":place.offset().top
        },200);
      }
    };

  });
})(jQuery,this,this.document);
