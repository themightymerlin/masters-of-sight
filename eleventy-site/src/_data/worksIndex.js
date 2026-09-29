const people = require("./people.json");

module.exports = function () {
  return people.map(function (p) {
    return {
      id: p.id,
      name: p.name,
      discipline: p.discipline,
      related: p.related || [],
      works: (p.works || []).map(function (w) {
        return { title: w.title, desc: w.desc };
      }),
      alsoWorkedOn: p.alsoWorkedOn || [],
    };
  });
};
