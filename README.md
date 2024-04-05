# MediaCMS

## Project Workflow

```mermaid
sequenceDiagram
autonumber

box Local
participant main 
participant stable
participant dev
end

box Origin
participant omain 
participant ostable
participant odev
end

box Upstream
participant umain 
end


umain -->> omain: Sync fork [on GitHub]

main ->> stable: git checkout stable main
stable ->> dev: git checkout dev stable
dev -->> odev: git push origin dev
dev -->> odev: git push origin dev
odev -->> ostable: PR [dev -> stable] & squash merge
ostable -->ostable: release & build docker image [ghcr]
```



## Branches

- `main` - upstream branch to keep the original code. 
- `stable` - stable branch to keep the stable code.
- `dev` - development branch, features are merged here.
- `features/*` - feature branches, new features are developed here.


Periodically sync changes from the original repository into this main branch:

